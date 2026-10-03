'use strict';

/**
 * Settlement service (see docs/backend-interface.md and spec/settlement-lnurl.md).
 *
 * Flow for each payout:
 *   1. createPayout: make a preimage, ask the backend for a hold invoice.
 *   2. Wait until the wallet's payment is held.
 *   3. Ask the payout provider to send the fiat.
 *   4. Payout succeeded: settle the hold. Payout failed or timed out: cancel it.
 *
 * The service talks only to the backend interface and to a payoutProvider
 * with one method:
 *   sendFiat({ phone, amount, currency }) -> Promise<{ ok: boolean }>
 *
 * Preimages are kept in memory only. A restart loses them, which means held
 * payments can no longer be settled. Persistent storage is still to be decided.
 */

const crypto = require('crypto');
const { HOLD_STATES } = require('./backend');

const STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
});

function sha256Hex(hex) {
  return crypto.createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex');
}

function sha256Utf8(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SettlementService {
  /**
   * @param {object} options
   * @param {object} options.backend         a SettlementBackend
   * @param {object} options.payoutProvider  object with sendFiat()
   * @param {number} [options.payoutTimeoutMs] how long the fiat payout may take before the hold is
   *   cancelled. A placeholder default: to be tuned against the HTLC timeout when testing on regtest.
   * @param {number} [options.settleAttempts]  tries at settling before flagging for attention
   * @param {number} [options.retryDelayMs]    pause between settle tries
   * @param {number} [options.maxPendingPayouts] most unpaid invoices allowed at once; beyond this,
   *   createPayout fails with code CAPACITY_EXCEEDED. Stops floods of invoices that are never paid.
   */
  constructor({ backend, payoutProvider, payoutTimeoutMs = 60000, settleAttempts = 3, retryDelayMs = 1000, maxPendingPayouts = 1000 }) {
    if (!backend) throw new Error('backend is required');
    if (!payoutProvider) throw new Error('payoutProvider is required');
    this.backend = backend;
    this.payoutProvider = payoutProvider;
    this.payoutTimeoutMs = payoutTimeoutMs;
    this.settleAttempts = settleAttempts;
    this.retryDelayMs = retryDelayMs;
    this.maxPendingPayouts = maxPendingPayouts;
    this.pendingCount = 0; // payouts whose invoice has not been paid yet
    this.payouts = new Map(); // paymentHash -> record
  }

  /**
   * Start a payout. Returns the invoice for the wallet to pay. Everything
   * after that happens in the background; poll getStatus() for progress.
   */
  async createPayout({ phone, amountMsat, payoutAmount, payoutCurrency, rateExpiry, metadata }) {
    if (!phone) throw new Error('phone is required');
    if (!Number.isInteger(amountMsat) || amountMsat <= 0) {
      throw new Error('amountMsat must be a positive whole number');
    }
    if (!payoutAmount) throw new Error('payoutAmount is required');
    if (!payoutCurrency) throw new Error('payoutCurrency is required');
    if (typeof metadata !== 'string' || !metadata) {
      throw new Error('metadata is required: the exact string advertised in the payRequest');
    }
    if (this.pendingCount >= this.maxPendingPayouts) {
      const err = new Error('too many unpaid payouts waiting');
      err.code = 'CAPACITY_EXCEEDED';
      throw err;
    }

    const expirySeconds = rateExpiry - Math.floor(Date.now() / 1000);
    if (!Number.isInteger(rateExpiry) || expirySeconds <= 0) {
      throw new Error('rateExpiry must be a future unix time in seconds');
    }

    const preimage = crypto.randomBytes(32).toString('hex');
    const paymentHash = sha256Hex(preimage);

    // The memo is generic on purpose: the payer should not see the phone number.
    const invoice = await this.backend.createHoldInvoice({
      paymentHash,
      amountMsat,
      expirySeconds,
      memo: 'Off-ramp payout',
      descriptionHash: sha256Utf8(metadata)
    });

    const record = {
      paymentHash,
      preimage,
      phone,
      amountMsat,
      payoutAmount,
      payoutCurrency,
      status: STATUS.PENDING,
      error: null,
      needsAttention: false,
      lateSuccessAfterCancel: false,
      done: null
    };
    this.payouts.set(paymentHash, record);
    this.pendingCount++;

    record.done = this._process(record).catch(() => {
      // _process handles its own failures; this is a last safety net.
      if (record.status === STATUS.PENDING) this._fail(record, 'NETWORK_ERROR');
    });

    return { paymentHash, bolt11: invoice.bolt11, expiresAt: invoice.expiresAt };
  }

  /** Current state of a payout, or null if unknown. */
  getStatus(paymentHash) {
    const rec = this.payouts.get(paymentHash);
    if (!rec) return null;
    return {
      status: rec.status,
      settled: rec.status === STATUS.COMPLETED,
      error: rec.error,
      needsAttention: rec.needsAttention,
      lateSuccessAfterCancel: rec.lateSuccessAfterCancel
    };
  }

  /** Resolves when the background work for a payout has finished. */
  whenDone(paymentHash) {
    const rec = this.payouts.get(paymentHash);
    return rec ? rec.done : Promise.resolve();
  }

  async _process(rec) {
    const held = await this.backend.waitUntilHeld({ paymentHash: rec.paymentHash });
    if (held.state !== HOLD_STATES.HELD) {
      this._fail(rec, held.state === HOLD_STATES.EXPIRED ? 'HOLD_EXPIRED' : 'CANCELLED');
      return;
    }

    this.pendingCount--;
    rec.status = STATUS.PROCESSING;
    const outcome = await this._sendFiatWithTimeout(rec);

    if (!outcome.ok) {
      await this._cancelHold(rec);
      this._fail(rec, outcome.reason);
      return;
    }
    await this._settleWithRetry(rec);
  }

  async _sendFiatWithTimeout(rec) {
    const call = Promise.resolve().then(() =>
      this.payoutProvider.sendFiat({
        phone: rec.phone,
        amount: rec.payoutAmount,
        currency: rec.payoutCurrency
      })
    );

    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), this.payoutTimeoutMs);
    });
    const first = await Promise.race([
      call.then((result) => ({ result }), (error) => ({ error })),
      timeout
    ]);
    clearTimeout(timer);

    if (first.timedOut) {
      // If the fiat arrives after we cancelled, flag it so someone can reconcile.
      call.then(
        (result) => { if (result && result.ok) rec.lateSuccessAfterCancel = true; },
        () => {}
      );
      return { ok: false, reason: 'PAYOUT_TIMEOUT' };
    }
    if (first.error) return { ok: false, reason: 'PAYOUT_FAILED' };
    return first.result && first.result.ok ? { ok: true } : { ok: false, reason: 'PAYOUT_FAILED' };
  }

  async _cancelHold(rec) {
    try {
      await this.backend.cancel({ paymentHash: rec.paymentHash });
    } catch (err) {
      rec.needsAttention = true;
    }
  }

  async _settleWithRetry(rec) {
    for (let attempt = 1; attempt <= this.settleAttempts; attempt++) {
      try {
        await this.backend.settle({ preimage: rec.preimage });
        rec.status = STATUS.COMPLETED;
        rec.preimage = null;
        return;
      } catch (err) {
        if (attempt < this.settleAttempts) await sleep(this.retryDelayMs);
      }
    }
    // Fiat was paid but the hold could not be settled. Stay in processing and flag it.
    rec.error = 'SETTLE_FAILED';
    rec.needsAttention = true;
  }

  _fail(rec, reason) {
    if (rec.status === STATUS.PENDING) this.pendingCount--;
    rec.status = STATUS.FAILED;
    rec.error = reason;
    rec.preimage = null;
  }
}

module.exports = { SettlementService, STATUS };
