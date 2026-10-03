'use strict';

// Run with: node --test test/settlement/lnurl-server.test.js

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { MemoryBackend } = require('../../src/settlement/memory-backend');
const { SettlementService } = require('../../src/settlement/service');
const { createLnurlApp } = require('../../src/settlement/lnurl-server');

const PHONE = '0971234567';
const AMOUNT_MSAT = 1000000;

async function defaultQuote({ amountMsat }) {
  return {
    payoutAmount: ((amountMsat / 1000 / 1000) * 13).toFixed(2),
    payoutCurrency: 'ZMW',
    feeTotal: '0.00',
    rateExpiry: Math.floor(Date.now() / 1000) + 300
  };
}

async function start(overrides = {}) {
  const backend = new MemoryBackend();
  const payoutProvider = {
    async sendFiat() {
      return overrides.fiatResult || { ok: true };
    }
  };
  const service = new SettlementService({ backend, payoutProvider, retryDelayMs: 1 });

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const app = createLnurlApp({
    service,
    getQuote: overrides.getQuote || defaultQuote,
    baseUrl,
    minSendableMsat: 1000,
    maxSendableMsat: 100000000
  });
  server.on('request', app);

  return {
    backend,
    service,
    baseUrl,
    async stop() {
      // Cancel anything unpaid so no timers keep the test process alive.
      for (const paymentHash of backend.invoices.keys()) {
        try {
          await backend.cancel({ paymentHash });
        } catch (err) {
          // already settled, nothing to cancel
        }
      }
      await Promise.all([...service.payouts.keys()].map((h) => service.whenDone(h)));
      if (server.closeAllConnections) server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function run(fn, overrides) {
  const t = await start(overrides);
  try {
    await fn(t);
  } finally {
    await t.stop();
  }
}

async function getJson(url) {
  const res = await fetch(url);
  return { status: res.status, headers: res.headers, body: await res.json() };
}

function getWithHost(url, host) {
  return new Promise((resolve, reject) => {
    http
      .get(url, { headers: { Host: host } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(JSON.parse(data)));
      })
      .on('error', reject);
  });
}

test('lookup returns a payRequest pointing at the configured baseUrl', () =>
  run(async (t) => {
    const { body } = await getJson(`${t.baseUrl}/.well-known/lnurlp/${PHONE}`);

    assert.strictEqual(body.tag, 'payRequest');
    assert.strictEqual(body.callback, `${t.baseUrl}/lnurl/callback/${PHONE}`);
    assert.strictEqual(body.minSendable, 1000);
    assert.strictEqual(body.maxSendable, 100000000);
    assert.ok(Array.isArray(JSON.parse(body.metadata)));
  }));

test('callback URLs ignore a forged Host header', () =>
  run(async (t) => {
    const body = await getWithHost(`${t.baseUrl}/.well-known/lnurlp/${PHONE}`, 'evil.example.com');

    assert.ok(body.callback.startsWith(t.baseUrl));
    assert.ok(!body.callback.includes('evil'));
  }));

test('responses allow browser wallets through CORS', () =>
  run(async (t) => {
    const { headers } = await getJson(`${t.baseUrl}/.well-known/lnurlp/${PHONE}`);

    assert.strictEqual(headers.get('access-control-allow-origin'), '*');
  }));

test('a malformed payout number is refused with RECIPIENT_UNREACHABLE', () =>
  run(async (t) => {
    const { body } = await getJson(`${t.baseUrl}/.well-known/lnurlp/abc123`);

    assert.strictEqual(body.status, 'ERROR');
    assert.strictEqual(body.code, 'RECIPIENT_UNREACHABLE');
  }));

test('full flow: lookup, callback, pay, then verify reports completed', () =>
  run(async (t) => {
    const lookup = (await getJson(`${t.baseUrl}/.well-known/lnurlp/${PHONE}`)).body;
    const cb = (await getJson(`${lookup.callback}?amount=${AMOUNT_MSAT}`)).body;

    assert.ok(cb.pr.startsWith('lnbc'));
    assert.strictEqual(cb.payoutAmount, '13.00');
    assert.strictEqual(cb.payoutCurrency, 'ZMW');
    assert.strictEqual(cb.feeTotal, '0.00');
    assert.ok(Number.isInteger(cb.rateExpiry));
    assert.ok(cb.verify.startsWith(`${t.baseUrl}/lnurl/verify/`));

    const hash = cb.verify.split('/').pop();
    assert.deepStrictEqual((await getJson(cb.verify)).body, { status: 'pending', settled: false });

    t.backend.simulateIncomingPayment(hash, AMOUNT_MSAT);
    await t.service.whenDone(hash);

    assert.deepStrictEqual((await getJson(cb.verify)).body, { status: 'completed', settled: true });
  }));

test('a failed payout shows failed with a reason code on verify', () =>
  run(async (t) => {
    const lookup = (await getJson(`${t.baseUrl}/.well-known/lnurlp/${PHONE}`)).body;
    const cb = (await getJson(`${lookup.callback}?amount=${AMOUNT_MSAT}`)).body;
    const hash = cb.verify.split('/').pop();

    t.backend.simulateIncomingPayment(hash, AMOUNT_MSAT);
    await t.service.whenDone(hash);

    assert.deepStrictEqual((await getJson(cb.verify)).body, {
      status: 'failed',
      settled: false,
      code: 'PAYOUT_FAILED'
    });
  }, { fiatResult: { ok: false } }));

test('amounts below the minimum and above the maximum get the right codes', () =>
  run(async (t) => {
    const cb = `${t.baseUrl}/lnurl/callback/${PHONE}`;

    const low = (await getJson(`${cb}?amount=999`)).body;
    assert.strictEqual(low.status, 'ERROR');
    assert.strictEqual(low.code, 'AMOUNT_TOO_LOW');

    const high = (await getJson(`${cb}?amount=100000001`)).body;
    assert.strictEqual(high.status, 'ERROR');
    assert.strictEqual(high.code, 'AMOUNT_TOO_HIGH');
  }));

test('a missing or malformed amount is refused', () =>
  run(async (t) => {
    const cb = `${t.baseUrl}/lnurl/callback/${PHONE}`;

    for (const query of ['', '?amount=abc', '?amount=1.5', '?amount=-5', '?amount=1&amount=2']) {
      const { body } = await getJson(`${cb}${query}`);
      assert.strictEqual(body.status, 'ERROR', `query "${query}" should be refused`);
    }
  }));

test('a quote refusal passes its known code through and drops unknown ones', () =>
  run(async (t) => {
    const cb = `${t.baseUrl}/lnurl/callback/${PHONE}?amount=${AMOUNT_MSAT}`;

    const refused = (await getJson(cb)).body;
    assert.strictEqual(refused.status, 'ERROR');
    assert.strictEqual(refused.code, 'RECIPIENT_UNREACHABLE');
    assert.strictEqual(refused.reason, 'Number not registered');
  }, {
    getQuote: async () => ({ error: { code: 'RECIPIENT_UNREACHABLE', reason: 'Number not registered' } })
  }));

test('an unknown quote error code is not passed on', () =>
  run(async (t) => {
    const { body } = await getJson(`${t.baseUrl}/lnurl/callback/${PHONE}?amount=${AMOUNT_MSAT}`);

    assert.strictEqual(body.status, 'ERROR');
    assert.strictEqual(body.code, undefined);
  }, {
    getQuote: async () => ({ error: { code: 'MADE_UP_CODE', reason: 'Nope' } })
  }));

test('a quote function that throws gives NETWORK_ERROR', () =>
  run(async (t) => {
    const { body } = await getJson(`${t.baseUrl}/lnurl/callback/${PHONE}?amount=${AMOUNT_MSAT}`);

    assert.strictEqual(body.status, 'ERROR');
    assert.strictEqual(body.code, 'NETWORK_ERROR');
  }, {
    getQuote: async () => {
      throw new Error('rate service down');
    }
  }));

test('verify for an unknown or badly formed id is a 404', () =>
  run(async (t) => {
    const unknown = await getJson(`${t.baseUrl}/lnurl/verify/${'00'.repeat(32)}`);
    assert.strictEqual(unknown.status, 404);
    assert.strictEqual(unknown.body.status, 'ERROR');

    const bad = await getJson(`${t.baseUrl}/lnurl/verify/not-a-hash`);
    assert.strictEqual(bad.status, 404);
  }));

test('setup is refused when baseUrl or limits are wrong', () => {
  const service = {};
  const getQuote = async () => ({});

  assert.throws(() => createLnurlApp({ service, getQuote, baseUrl: 'pay.example.com' }), /baseUrl/);
  assert.throws(
    () => createLnurlApp({ service, getQuote, baseUrl: 'https://pay.example.com', minSendableMsat: 500, maxSendableMsat: 100 }),
    /minSendableMsat/
  );
});
