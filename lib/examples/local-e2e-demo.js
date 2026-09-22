#!/usr/bin/env node

/**
 * Local end-to-end demonstration: Application -> Lipa Discovery -> Provider
 * -> Settlement (LNURL).
 *
 * SIMULATION ONLY. Runs entirely in-memory/localhost — no real Nostr relays,
 * no real Lightning node. It exists to narrate the full arc in one place:
 * an application asks a discovery-layer question ("find a Zambia off-ramp
 * from Lightning to MTN MoMo") without knowing any provider in advance, and
 * ends up completing a simulated settlement with whichever provider matched.
 *
 * This demo is separate from the production protocol. The discovery server
 * here is backed by two fictional in-memory listings, not real relays — see
 * examples/publish-service.js / publish-cross-border.js for scripts that
 * publish real test listings to public relays instead.
 *
 * Usage: node examples/local-e2e-demo.js
 */

const { createHttpTransport } = require('../src/transports/http/server');
const express = require('express');

function line() { console.log('-'.repeat(60)); }

// ---------------------------------------------------------------------------
// Step 0: two fictional Zambia providers, differing by rails.out. Only
// Provider A supports mtn-momo, so it's the only correct match for the
// application's query below.
// ---------------------------------------------------------------------------

const providerA = {
  pubkey: 'a'.repeat(64),
  id: 'demo-zm-off-ramp-a',
  publishedAt: new Date(),
  name: 'Demo Provider A (Zambia)',
  country: 'ZM',
  direction: 'off-ramp',
  service_type: 'currency-exchange',
  rails: { in: ['lightning'], out: ['mtn-momo'] },
  currency: 'ZMW',
  endpoint: null,
  health: null,
  status: 'active',
  kyc: 'none',
  protocols: ['bolt11', 'lnurl'],
  lnaddr: null, // filled in once the LNURL mock server's port is known
  metadata: { description: 'Fictional demo provider — supports MTN MoMo.' }
};

const providerB = {
  pubkey: 'b'.repeat(64),
  id: 'demo-zm-off-ramp-b',
  publishedAt: new Date(),
  name: 'Demo Provider B (Zambia)',
  country: 'ZM',
  direction: 'off-ramp',
  service_type: 'currency-exchange',
  rails: { in: ['lightning'], out: ['airtel-money'] }, // no mtn-momo
  currency: 'ZMW',
  endpoint: null,
  health: null,
  status: 'active',
  kyc: 'none',
  protocols: ['bolt11'],
  lnaddr: null,
  metadata: { description: 'Fictional demo provider — supports Airtel Money only, not MTN MoMo.' }
};

function makeFakeQuerier(providers) {
  return {
    relays: ['local-demo'],
    async find(filters) {
      return providers.filter(p => {
        if (filters.country && p.country !== filters.country.toUpperCase()) return false;
        if (filters.direction && p.direction !== filters.direction) return false;
        if (filters.service_type && (p.service_type || 'currency-exchange') !== filters.service_type) return false;
        if (filters.rail_out && !p.rails.out.includes(filters.rail_out)) return false;
        return true;
      });
    },
    async findHealthy(filters) { return this.find(filters); },
    close() {}
  };
}

// ---------------------------------------------------------------------------
// Step 0b: a minimal inline LNURL mock provider (same shape as
// examples/lnurl-mock-provider.js), for Provider A to settle through.
// ---------------------------------------------------------------------------

function makeLnurlMockApp() {
  const app = express();
  const payouts = new Map();
  let counter = 0;

  app.get('/.well-known/lnurlp/:phone', (req, res) => {
    res.json({
      tag: 'payRequest',
      callback: `http://localhost:${app.get('port')}/lnurl/callback?phone=${req.params.phone}`,
      minSendable: 1000,
      maxSendable: 100000000,
      metadata: JSON.stringify([['text/plain', `Off-ramp payout to ${req.params.phone}`]])
    });
  });

  app.get('/lnurl/callback', (req, res) => {
    const { amount, phone } = req.query;
    const id = `payout_${++counter}`;
    const amountSats = Number(amount) / 1000;
    const payoutAmount = ((amountSats / 1000) * 13).toFixed(2); // fake ZMW rate
    payouts.set(id, { status: 'pending', phone, amountSats });

    res.json({
      pr: `lnbc${amountSats}n1FAKEHOLDINVOICE${id}`,
      routes: [],
      payoutAmount,
      payoutCurrency: 'ZMW',
      feeTotal: '0.00',
      verify: `http://localhost:${app.get('port')}/lnurl/verify/${id}`,
      rateExpiry: Math.floor(Date.now() / 1000) + 300
    });
  });

  app.get('/lnurl/pay/:id', (req, res) => {
    const payout = payouts.get(req.params.id);
    if (!payout) return res.status(404).json({ error: 'not_found' });
    payout.status = 'processing';
    setTimeout(() => { payout.status = 'completed'; }, 1000);
    res.json({ status: payout.status });
  });

  app.get('/lnurl/verify/:id', (req, res) => {
    const payout = payouts.get(req.params.id);
    if (!payout) return res.status(404).json({ error: 'not_found' });
    res.json({ status: payout.status, settled: payout.status === 'completed' });
  });

  return app;
}

function listenEphemeral(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      app.set('port', server.address().port);
      resolve(server);
    });
  });
}

// ---------------------------------------------------------------------------
// Main narrative
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Lipa Bitcoin Discovery — Local End-to-End Demo ===');
  console.log('SIMULATION ONLY: in-memory discovery, localhost settlement.\n');

  // Start the LNURL mock provider first, so we know its port before wiring
  // Provider A's lnaddr to point at it.
  const lnurlApp = makeLnurlMockApp();
  const lnurlServer = await listenEphemeral(lnurlApp);
  const lnurlPort = lnurlApp.get('port');
  providerA.lnaddr = `{phone}@localhost:${lnurlPort}`;

  console.log(`[setup] LNURL mock provider listening on :${lnurlPort} (simulates Provider A's real server)`);

  // Start the discovery HTTP transport, backed by our two fictional listings.
  const fakeQuerier = makeFakeQuerier([providerA, providerB]);
  const discoveryApp = createHttpTransport({ querier: fakeQuerier });
  const discoveryServer = await listenEphemeral(discoveryApp);
  const discoveryPort = discoveryServer.address().port;
  console.log(`[setup] Lipa Discovery HTTP transport listening on :${discoveryPort} (in-memory, two fictional providers)\n`);

  line();
  console.log('STEP 1 — Application queries Lipa Discovery');
  line();
  console.log('The application knows nothing about either provider by name.');
  console.log('It only knows: "I need a Zambia off-ramp, Lightning -> MTN MoMo."\n');

  const query = new URL('/v1/services', `http://localhost:${discoveryPort}`);
  query.searchParams.set('country', 'ZM');
  query.searchParams.set('direction', 'off-ramp');
  query.searchParams.set('rail_out', 'mtn-momo');

  const res = await fetch(query);
  const result = await res.json();

  console.log(`Query: GET ${query.pathname}${query.search}`);
  console.log(`Result: ${result.count} provider(s) matched.\n`);

  for (const svc of result.services) {
    console.log(`  -> ${svc.provider.name} (rails out: ${svc.rails.out.join(', ')})`);
  }
  console.log(`\n(Provider B was correctly excluded — it only supports: ${providerB.rails.out.join(', ')})\n`);

  if (result.count !== 1) {
    console.error('Unexpected result count, aborting demo.');
    process.exit(1);
  }

  const matched = result.services[0];

  line();
  console.log('STEP 2 — Application reads the provider\'s interaction capability');
  line();
  console.log(`Protocols advertised: ${matched.protocols.join(', ')}`);
  console.log(`Lightning Address template: ${matched.lnaddr}\n`);

  const phone = '260971234567';
  const lnaddrResolved = matched.lnaddr.replace('{phone}', phone);
  const [user, host] = lnaddrResolved.split('@');
  console.log(`Resolving Lightning Address for phone ${phone}: ${lnaddrResolved}\n`);

  line();
  console.log('STEP 3 — Settlement handoff (simulated LNURL flow)');
  line();

  const payReq = await (await fetch(`http://${host}/.well-known/lnurlp/${user}`)).json();
  console.log(`[wallet] Resolved payRequest. Callback: ${payReq.callback}`);

  const amountMsat = 50000000; // 50,000 sats
  const cb = await (await fetch(`${payReq.callback}&amount=${amountMsat}`)).json();
  console.log(`[provider] Quote: ${cb.payoutAmount} ${cb.payoutCurrency} for ${amountMsat / 1000} sats (fee: ${cb.feeTotal})`);
  console.log(`[provider] Invoice: ${cb.pr}\n`);

  const payoutId = cb.verify.split('/').pop();
  console.log(`[wallet] Paying invoice (simulated)...`);
  await fetch(`http://${host}/lnurl/pay/${payoutId}`);

  console.log(`[wallet] Polling delivery status...`);
  let status = 'pending';
  for (let i = 0; i < 5 && status !== 'completed'; i++) {
    await new Promise(r => setTimeout(r, 500));
    const v = await (await fetch(cb.verify)).json();
    status = v.status;
    console.log(`  ...status: ${status}`);
  }

  line();
  console.log('DONE');
  line();
  console.log('The application discovered a provider it had never heard of,');
  console.log('queried the local discovery service and completed a simulated');
  console.log('settlement — all without any hardcoded knowledge of that provider.\n');

  discoveryServer.close();
  lnurlServer.close();
}

main().catch((err) => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
