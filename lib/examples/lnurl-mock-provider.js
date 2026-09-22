/**
 * SIMULATION ONLY — mock LNURL off-ramp provider (spec/settlement-lnurl.md).
 *
 * This does NOT talk to a real Lightning node. Invoices are fake strings,
 * and "payment" is simulated by calling /lnurl/pay/:id yourself. This exists
 * purely to prove the LNURL profile's HTTP shape (payRequest -> callback ->
 * verify) matches the spec, for a listing's `lnaddr` field to point at.
 *
 * DO NOT use this as a starting point for a real provider. None of the
 * security considerations in spec/settlement-lnurl.md are implemented here
 * (host validation on address resolution, invoice-amount verification,
 * real hold-invoice accept/settle/cancel semantics). It proves the HTTP
 * conversation shape only, not a safe or functional settlement system.
 *
 * Usage: node examples/lnurl-mock-provider.js
 * Env:   PORT (default 9000)
 */

const express = require('express');

const port = process.env.PORT || 9000;
const app = express();

// In-memory store of simulated payouts: id -> { status, amountMsat, phone }
const payouts = new Map();
let counter = 0;

app.get('/.well-known/lnurlp/:phone', (req, res) => {
  const { phone } = req.params;
  res.json({
    tag: 'payRequest',
    callback: `http://localhost:${port}/lnurl/callback?phone=${phone}`,
    minSendable: 1000,       // 1 sat, in msat
    maxSendable: 100000000,  // 100k sats, in msat
    metadata: JSON.stringify([['text/plain', `Off-ramp payout to ${phone}`]])
  });
});

app.get('/lnurl/callback', (req, res) => {
  const { amount, phone } = req.query;
  if (!amount || !phone) {
    return res.status(400).json({ status: 'ERROR', reason: 'amount and phone are required' });
  }

  const id = `payout_${++counter}`;
  const amountMsat = Number(amount);
  const amountSats = amountMsat / 1000;

  // SIMULATION: fake fiat conversion at a made-up rate, no real quote engine.
  const fakeRate = 13; // 13 GHS per 1000 sats, arbitrary for this mock
  const payoutAmount = ((amountSats / 1000) * fakeRate).toFixed(2);

  payouts.set(id, { status: 'pending', phone, amountSats });

  res.json({
    pr: `lnbc${amountSats}n1FAKEHOLDINVOICE${id}`, // NOT a real bolt11 invoice
    routes: [],
    payoutAmount,
    payoutCurrency: 'GHS',
    feeTotal: '0.00',
    verify: `http://localhost:${port}/lnurl/verify/${id}`,
    rateExpiry: Math.floor(Date.now() / 1000) + 300
  });
});

// Simulate paying the hold invoice: marks it processing, then completed.
app.get('/lnurl/pay/:id', (req, res) => {
  const payout = payouts.get(req.params.id);
  if (!payout) return res.status(404).json({ error: 'not_found' });

  payout.status = 'processing';
  setTimeout(() => { payout.status = 'completed'; }, 2000);

  res.json({ status: payout.status, note: 'Simulated payment accepted; will complete shortly.' });
});

app.get('/lnurl/verify/:id', (req, res) => {
  const payout = payouts.get(req.params.id);
  if (!payout) return res.status(404).json({ error: 'not_found' });

  res.json({
    status: payout.status,
    settled: payout.status === 'completed'
  });
});

app.listen(port, () => {
  console.log(`Mock LNURL provider (SIMULATION ONLY) listening on :${port}`);
  console.log(`  GET /.well-known/lnurlp/:phone`);
  console.log(`  GET /lnurl/callback?amount=<msat>&phone=<phone>`);
  console.log(`  GET /lnurl/pay/:id       (simulate paying the invoice)`);
  console.log(`  GET /lnurl/verify/:id    (poll delivery status)`);
});
