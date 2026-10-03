'use strict';

// Run with: node --test test/settlement/memory-backend.test.js

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { MemoryBackend, hashOfPreimage } = require('../../src/settlement/memory-backend');

function newPayment() {
  const preimage = crypto.randomBytes(32).toString('hex');
  return { preimage, paymentHash: hashOfPreimage(preimage) };
}

async function newInvoice(backend, amountMsat = 1000000, expirySeconds = 300) {
  const payment = newPayment();
  await backend.createHoldInvoice({
    paymentHash: payment.paymentHash,
    amountMsat,
    expirySeconds,
    memo: 'test'
  });
  return payment;
}

test('a held payment can be settled with the right preimage', async () => {
  const backend = new MemoryBackend();
  const { preimage, paymentHash } = await newInvoice(backend);

  const waiting = backend.waitUntilHeld({ paymentHash });
  backend.simulateIncomingPayment(paymentHash, 1000000);

  assert.deepStrictEqual(await waiting, { state: 'held', amountMsat: 1000000 });
  assert.deepStrictEqual(await backend.settle({ preimage }), { settled: true });
});

test('cancelling wakes up anyone waiting and reports cancelled', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = await newInvoice(backend);

  const waiting = backend.waitUntilHeld({ paymentHash });
  await backend.cancel({ paymentHash });

  assert.deepStrictEqual(await waiting, { state: 'cancelled' });
});

test('waiting with a short timeout reports expired when nothing arrives', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = await newInvoice(backend);

  const result = await backend.waitUntilHeld({ paymentHash, timeoutMs: 50 });
  assert.deepStrictEqual(result, { state: 'expired' });
});

test('an invoice that passes its own expiry reports expired', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = await newInvoice(backend, 1000000, 1);

  const result = await backend.waitUntilHeld({ paymentHash });
  assert.deepStrictEqual(result, { state: 'expired' });
});

test('settling an invoice that is not held is refused', async () => {
  const backend = new MemoryBackend();
  const { preimage } = await newInvoice(backend);

  await assert.rejects(() => backend.settle({ preimage }), /cannot settle/);
});

test('settling with a wrong preimage is refused', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = await newInvoice(backend);
  backend.simulateIncomingPayment(paymentHash, 1000000);

  const wrong = crypto.randomBytes(32).toString('hex');
  await assert.rejects(() => backend.settle({ preimage: wrong }), /unknown paymentHash/);
});

test('a settled invoice cannot be cancelled', async () => {
  const backend = new MemoryBackend();
  const { preimage, paymentHash } = await newInvoice(backend);
  backend.simulateIncomingPayment(paymentHash, 1000000);
  await backend.settle({ preimage });

  await assert.rejects(() => backend.cancel({ paymentHash }), /cannot cancel a settled/);
});

test('a payment of the wrong amount is not accepted as held', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = await newInvoice(backend);

  assert.throws(() => backend.simulateIncomingPayment(paymentHash, 999), /amount does not match/);
});

test('creating the same invoice twice is refused', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = await newInvoice(backend);

  await assert.rejects(
    () => backend.createHoldInvoice({ paymentHash, amountMsat: 1000, expirySeconds: 60 }),
    /already exists/
  );
});

test('bad input to createHoldInvoice is refused', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = newPayment();

  await assert.rejects(
    () => backend.createHoldInvoice({ paymentHash: 'nothex', amountMsat: 1000, expirySeconds: 60 }),
    /paymentHash/
  );
  await assert.rejects(
    () => backend.createHoldInvoice({ paymentHash, amountMsat: -5, expirySeconds: 60 }),
    /amountMsat/
  );
  await assert.rejects(
    () => backend.createHoldInvoice({ paymentHash, amountMsat: 1000, expirySeconds: 0 }),
    /expirySeconds/
  );
});

test('a description hash is stored, and a malformed one is refused', async () => {
  const backend = new MemoryBackend();
  const { paymentHash } = newPayment();
  const descriptionHash = crypto.randomBytes(32).toString('hex');

  await backend.createHoldInvoice({ paymentHash, amountMsat: 1000, expirySeconds: 60, descriptionHash });
  assert.strictEqual(backend.invoices.get(paymentHash).descriptionHash, descriptionHash);

  const other = newPayment();
  await assert.rejects(
    () => backend.createHoldInvoice({ paymentHash: other.paymentHash, amountMsat: 1000, expirySeconds: 60, descriptionHash: 'nothex' }),
    /descriptionHash/
  );
  await backend.cancel({ paymentHash });
});
