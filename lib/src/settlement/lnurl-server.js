'use strict';

/**
 * LNURL web layer for the off-ramp settlement profile (spec/settlement-lnurl.md).
 *
 * Exposes three endpoints on top of a SettlementService:
 *   GET /.well-known/lnurlp/:phone       resolve the Lightning Address (LUD-16)
 *   GET /lnurl/callback/:phone?amount=   quote and hold invoice (LUD-06)
 *   GET /lnurl/verify/:paymentHash       delivery status (LUD-21, extended)
 *
 * The caller supplies getQuote({ phone, amountMsat }), which returns
 *   { payoutAmount, payoutCurrency, feeTotal, rateExpiry }   (rateExpiry in unix seconds)
 * or { error: { code, reason } } to refuse the request.
 *
 * Callback URLs are built from the configured baseUrl, never from the Host
 * header of the incoming request.
 */

const express = require('express');

// Error codes from the profile's Error Codes section.
const ERROR_CODES = new Set([
  'RECIPIENT_UNREACHABLE',
  'AMOUNT_TOO_LOW',
  'AMOUNT_TOO_HIGH',
  'CAPACITY_EXCEEDED',
  'NETWORK_ERROR',
  'PROVIDER_OFFLINE',
  'HOLD_EXPIRED'
]);

const PHONE_RE = /^\d{6,15}$/;
const AMOUNT_RE = /^\d{1,15}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

function createLnurlApp({
  service,
  getQuote,
  baseUrl,
  minSendableMsat = 1000,
  maxSendableMsat = 100000000
}) {
  if (!service) throw new Error('service is required');
  if (typeof getQuote !== 'function') throw new Error('getQuote must be a function');
  try {
    new URL(baseUrl);
  } catch (err) {
    throw new Error('baseUrl must be a full URL, such as https://pay.example.com');
  }
  if (!Number.isInteger(minSendableMsat) || !Number.isInteger(maxSendableMsat) ||
      minSendableMsat <= 0 || minSendableMsat > maxSendableMsat) {
    throw new Error('minSendableMsat and maxSendableMsat must be whole numbers, min no larger than max');
  }

  const root = String(baseUrl).replace(/\/+$/, '');
  const app = express();
  app.disable('x-powered-by');

  // Browser-based wallets need CORS to call these endpoints.
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    next();
  });

  // LUD-06 style errors: HTTP 200 with status ERROR, plus a machine-readable code.
  function lnurlError(res, reason, code) {
    const body = { status: 'ERROR', reason };
    if (code && ERROR_CODES.has(code)) body.code = code;
    return res.json(body);
  }

  app.get('/.well-known/lnurlp/:phone', (req, res) => {
    const { phone } = req.params;
    if (!PHONE_RE.test(phone)) {
      return lnurlError(res, 'Not a valid payout number', 'RECIPIENT_UNREACHABLE');
    }
    res.json({
      tag: 'payRequest',
      callback: `${root}/lnurl/callback/${phone}`,
      minSendable: minSendableMsat,
      maxSendable: maxSendableMsat,
      metadata: JSON.stringify([['text/plain', 'Off-ramp payout']])
    });
  });

  app.get('/lnurl/callback/:phone', async (req, res) => {
    const { phone } = req.params;
    if (!PHONE_RE.test(phone)) {
      return lnurlError(res, 'Not a valid payout number', 'RECIPIENT_UNREACHABLE');
    }

    const amountParam = req.query.amount;
    if (typeof amountParam !== 'string' || !AMOUNT_RE.test(amountParam)) {
      return lnurlError(res, 'amount must be a whole number of millisatoshis');
    }
    const amountMsat = Number(amountParam);
    if (amountMsat < minSendableMsat) {
      return lnurlError(res, `Minimum is ${minSendableMsat} msat`, 'AMOUNT_TOO_LOW');
    }
    if (amountMsat > maxSendableMsat) {
      return lnurlError(res, `Maximum is ${maxSendableMsat} msat`, 'AMOUNT_TOO_HIGH');
    }

    let quote;
    try {
      quote = await getQuote({ phone, amountMsat });
    } catch (err) {
      return lnurlError(res, 'Could not get a quote, please try again', 'NETWORK_ERROR');
    }
    if (quote && quote.error) {
      return lnurlError(res, quote.error.reason || 'Quote refused', quote.error.code);
    }
    if (!quote || !quote.payoutAmount || !quote.payoutCurrency || !Number.isInteger(quote.rateExpiry)) {
      return lnurlError(res, 'Quote unavailable, please try again', 'PROVIDER_OFFLINE');
    }

    let created;
    try {
      created = await service.createPayout({
        phone,
        amountMsat,
        payoutAmount: String(quote.payoutAmount),
        payoutCurrency: quote.payoutCurrency,
        rateExpiry: quote.rateExpiry
      });
    } catch (err) {
      return lnurlError(res, 'Provider unavailable, please try again', 'PROVIDER_OFFLINE');
    }

    res.json({
      pr: created.bolt11,
      routes: [],
      payoutCurrency: quote.payoutCurrency,
      payoutAmount: String(quote.payoutAmount),
      feeTotal: String(quote.feeTotal === undefined ? '0' : quote.feeTotal),
      verify: `${root}/lnurl/verify/${created.paymentHash}`,
      rateExpiry: quote.rateExpiry
    });
  });

  app.get('/lnurl/verify/:paymentHash', (req, res) => {
    const { paymentHash } = req.params;
    const info = HASH_RE.test(paymentHash) ? service.getStatus(paymentHash) : null;
    if (!info) {
      return res.status(404).json({ status: 'ERROR', reason: 'Not found' });
    }
    const body = { status: info.status, settled: info.settled };
    if (info.status === 'failed' && info.error) body.code = info.error;
    res.json(body);
  });

  return app;
}

module.exports = { createLnurlApp, ERROR_CODES };
