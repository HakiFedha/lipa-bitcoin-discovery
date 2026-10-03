/**
 * SIMULATION ONLY: walks through the whole off-ramp settlement flow.
 *
 * Starts the LNURL settlement server on a fake backend, plays the part of a
 * wallet, and prints each step in plain language. No Lightning node, no real
 * Bitcoin and no real mobile money are involved. The invoice is a fake string,
 * the "payment" is simulated, and the rate is made up.
 *
 * Runs two scenarios: fiat payout succeeds, and fiat payout fails.
 *
 * Usage: node examples/settlement-demo.js
 */

const http = require('http');
const { MemoryBackend } = require('../src/settlement/memory-backend');
const { SettlementService } = require('../src/settlement/service');
const { createLnurlApp } = require('../src/settlement/lnurl-server');

const PHONE = '0971234567';
const AMOUNT_SATS = 50000;
const AMOUNT_MSAT = AMOUNT_SATS * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

// Made-up rate: 13 ZMW per 1,000 sats. A real provider would call its rate engine here.
async function getQuote({ amountMsat }) {
  return {
    payoutAmount: ((amountMsat / 1000 / 1000) * 13).toFixed(2),
    payoutCurrency: 'ZMW',
    feeTotal: '0.00',
    rateExpiry: Math.floor(Date.now() / 1000) + 300
  };
}

async function runScenario(title, fiatWorks) {
  console.log(`\n=== ${title} ===`);

  const backend = new MemoryBackend();
  const payoutProvider = {
    async sendFiat() {
      await sleep(1000); // pretend the mobile money network takes a second
      return { ok: fiatWorks };
    }
  };
  const service = new SettlementService({ backend, payoutProvider });

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  server.on('request', createLnurlApp({ service, getQuote, baseUrl }));

  try {
    const lookup = await getJson(`${baseUrl}/.well-known/lnurlp/${PHONE}`);
    console.log(`1. The wallet looks up ${PHONE}@provider. The provider replies that it accepts`);
    console.log(`   between ${lookup.minSendable / 1000} and ${lookup.maxSendable / 1000} sats.`);

    const quote = await getJson(`${lookup.callback}?amount=${AMOUNT_MSAT}`);
    console.log(`2. The wallet asks to send ${AMOUNT_SATS} sats. The provider quotes: the recipient`);
    console.log(`   receives ${quote.payoutAmount} ${quote.payoutCurrency}, fee ${quote.feeTotal}. It also returns a hold invoice.`);

    const paymentHash = quote.verify.split('/').pop();
    backend.simulateIncomingPayment(paymentHash, AMOUNT_MSAT);
    console.log('3. The wallet pays the invoice (simulated). The sats are HELD, not yet taken.');

    console.log('4. The wallet polls the provider for delivery status:');
    let last = null;
    for (let i = 0; i < 40; i++) {
      const state = await getJson(quote.verify);
      if (state.status !== last) {
        console.log(`   status: ${state.status}${state.code ? ` (${state.code})` : ''}`);
        last = state.status;
      }
      if (state.status === 'completed' || state.status === 'failed') break;
      await sleep(250);
    }

    const held = backend.invoices.get(paymentHash).state;
    if (held === 'settled') {
      console.log('5. Result: the mobile money arrived, so the provider claimed the sats.');
    } else {
      console.log('5. Result: the payout failed, so the hold was cancelled and the sats go back');
      console.log('   to the wallet. Nothing was lost.');
    }
  } finally {
    for (const hash of backend.invoices.keys()) {
      try {
        await backend.cancel({ paymentHash: hash });
      } catch (err) {
        // already settled, nothing to cancel
      }
    }
    await Promise.all([...service.payouts.keys()].map((h) => service.whenDone(h)));
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

(async () => {
  console.log('SIMULATION ONLY: fake invoice, fake rate, no real money.');
  await runScenario('Scenario A: the mobile money payout works', true);
  await runScenario('Scenario B: the mobile money payout fails', false);
  console.log('\nDone.');
})();
