'use strict';

// Run with: node --test test/settlement/service.test.js

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { MemoryBackend } = require('../../src/settlement/memory-backend');
const { SettlementService } = require('../../src/settlement/service');

const AMOUNT_MSAT = 1000000;
const METADATA = '[["text/plain","Off-ramp payout"]]';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeProvider(behaviour) {
  const calls = [];
  return {
    calls,
    async sendFiat(args) {
      calls.push(args);
      return behaviour(args);
    }
  };
}

function setup(behaviour, options = {}) {
  const backend = new MemoryBackend();
  const payoutProvider = fakeProvider(behaviour);
  const service = new SettlementService({ backend, payoutProvider, ...options });
  return { backend, payoutProvider, service };
}

function newPayout(service, rateExpiryInSeconds = 300) {
  return service.createPayout({
    phone: '0971234567',
    amountMsat: AMOUNT_MSAT,
    payoutAmount: '13.00',
    payoutCurrency: 'ZMW',
    rateExpiry: Math.floor(Date.now() / 1000) + rateExpiryInSeconds,
    metadata: METADATA
  });
}

test('happy path: payment held, fiat sent, hold settled, status completed', async () => {
  const { backend, payoutProvider, service } = setup(async () => ({ ok: true }));
  const { paymentHash } = await newPayout(service);

  assert.strictEqual(service.getStatus(paymentHash).status, 'pending');
  backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
  await service.whenDone(paymentHash);

  assert.deepStrictEqual(service.getStatus(paymentHash), {
    status: 'completed',
    settled: true,
    error: null,
    needsAttention: false,
    lateSuccessAfterCancel: false
  });
  assert.strictEqual(backend.invoices.get(paymentHash).state, 'settled');
  assert.deepStrictEqual(payoutProvider.calls, [
    { phone: '0971234567', amount: '13.00', currency: 'ZMW' }
  ]);
});

test('status is processing while the fiat payout is in progress', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { backend, service } = setup(async () => {
    await gate;
    return { ok: true };
  });
  const { paymentHash } = await newPayout(service);

  backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
  await sleep(20);
  assert.strictEqual(service.getStatus(paymentHash).status, 'processing');

  release();
  await service.whenDone(paymentHash);
  assert.strictEqual(service.getStatus(paymentHash).status, 'completed');
});

test('when the fiat payout reports failure, the hold is cancelled', async () => {
  const { backend, service } = setup(async () => ({ ok: false }));
  const { paymentHash } = await newPayout(service);

  backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
  await service.whenDone(paymentHash);

  const status = service.getStatus(paymentHash);
  assert.strictEqual(status.status, 'failed');
  assert.strictEqual(status.error, 'PAYOUT_FAILED');
  assert.strictEqual(backend.invoices.get(paymentHash).state, 'cancelled');
});

test('when the fiat payout throws, the hold is cancelled', async () => {
  const { backend, service } = setup(async () => {
    throw new Error('mobile money API down');
  });
  const { paymentHash } = await newPayout(service);

  backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
  await service.whenDone(paymentHash);

  assert.strictEqual(service.getStatus(paymentHash).error, 'PAYOUT_FAILED');
  assert.strictEqual(backend.invoices.get(paymentHash).state, 'cancelled');
});

test('a slow fiat payout times out and the hold is cancelled', async () => {
  const { backend, service } = setup(
    async () => {
      await sleep(150);
      return { ok: true };
    },
    { payoutTimeoutMs: 50 }
  );
  const { paymentHash } = await newPayout(service);

  backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
  await service.whenDone(paymentHash);

  assert.strictEqual(service.getStatus(paymentHash).status, 'failed');
  assert.strictEqual(service.getStatus(paymentHash).error, 'PAYOUT_TIMEOUT');
  assert.strictEqual(backend.invoices.get(paymentHash).state, 'cancelled');

  // The fiat then arrives late: this must be flagged for reconciliation.
  await sleep(200);
  assert.strictEqual(service.getStatus(paymentHash).lateSuccessAfterCancel, true);
});

test('if the wallet never pays, the payout fails with HOLD_EXPIRED', async () => {
  const { payoutProvider, service } = setup(async () => ({ ok: true }));
  const { paymentHash } = await newPayout(service, 1);

  await service.whenDone(paymentHash);

  assert.strictEqual(service.getStatus(paymentHash).status, 'failed');
  assert.strictEqual(service.getStatus(paymentHash).error, 'HOLD_EXPIRED');
  assert.strictEqual(payoutProvider.calls.length, 0);
});

test('if settling keeps failing, the payout is flagged for attention', async () => {
  const { backend, service } = setup(async () => ({ ok: true }), {
    settleAttempts: 2,
    retryDelayMs: 1
  });
  backend.settle = async () => {
    throw new Error('node unreachable');
  };
  const { paymentHash } = await newPayout(service);

  backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
  await service.whenDone(paymentHash);

  const status = service.getStatus(paymentHash);
  assert.strictEqual(status.status, 'processing');
  assert.strictEqual(status.error, 'SETTLE_FAILED');
  assert.strictEqual(status.needsAttention, true);
});

test('a rateExpiry in the past is refused', async () => {
  const { service } = setup(async () => ({ ok: true }));

  await assert.rejects(() => newPayout(service, -10), /rateExpiry/);
});

test('missing details are refused', async () => {
  const { service } = setup(async () => ({ ok: true }));
  const rateExpiry = Math.floor(Date.now() / 1000) + 300;

  await assert.rejects(
    () => service.createPayout({ amountMsat: AMOUNT_MSAT, payoutAmount: '1', payoutCurrency: 'ZMW', rateExpiry }),
    /phone/
  );
  await assert.rejects(
    () => service.createPayout({ phone: '1', amountMsat: 0, payoutAmount: '1', payoutCurrency: 'ZMW', rateExpiry }),
    /amountMsat/
  );
});

test('an unknown payout has no status', () => {
  const { service } = setup(async () => ({ ok: true }));

  assert.strictEqual(service.getStatus('00'.repeat(32)), null);
});

test('the invoice carries the hash of the advertised metadata', async () => {
  const { backend, service } = setup(async () => ({ ok: true }));
  const { paymentHash } = await newPayout(service);

  const expected = crypto.createHash('sha256').update(METADATA, 'utf8').digest('hex');
  assert.strictEqual(backend.invoices.get(paymentHash).descriptionHash, expected);

  backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
  await service.whenDone(paymentHash);
});

test('a payout without metadata is refused', async () => {
  const { service } = setup(async () => ({ ok: true }));

  await assert.rejects(
    () => service.createPayout({
      phone: '0971234567',
      amountMsat: AMOUNT_MSAT,
      payoutAmount: '13.00',
      payoutCurrency: 'ZMW',
      rateExpiry: Math.floor(Date.now() / 1000) + 300
    }),
    /metadata/
  );
});

test('too many unpaid payouts are refused, and room frees up once one is paid', async () => {
  const { backend, service } = setup(async () => ({ ok: true }), { maxPendingPayouts: 1 });
  const first = await newPayout(service);

  await assert.rejects(() => newPayout(service), (err) => err.code === 'CAPACITY_EXCEEDED');

  backend.simulateIncomingPayment(first.paymentHash, AMOUNT_MSAT);
  await service.whenDone(first.paymentHash);

  const third = await newPayout(service);
  backend.simulateIncomingPayment(third.paymentHash, AMOUNT_MSAT);
  await service.whenDone(third.paymentHash);
  assert.strictEqual(service.getStatus(third.paymentHash).status, 'completed');
});
