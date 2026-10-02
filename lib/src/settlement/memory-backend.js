'use strict';

/**
 * SIMULATION ONLY: in-memory settlement backend.
 *
 * Talks to no Lightning node. Invoices are fake strings and "payment" is
 * simulated by calling simulateIncomingPayment() yourself. It exists so the
 * settlement logic can be built and tested before a real backend (LND on
 * regtest) is added. Never use it with real funds.
 */

const crypto = require('crypto');
const { SettlementBackend, HOLD_STATES } = require('./backend');

function hashOfPreimage(preimageHex) {
  return crypto.createHash('sha256').update(Buffer.from(preimageHex, 'hex')).digest('hex');
}

class MemoryBackend extends SettlementBackend {
  constructor() {
    super();
    // paymentHash -> { amountMsat, memo, expiresAt, state, waiters }
    // state is one of: open, held, settled, cancelled
    this.invoices = new Map();
  }

  async createHoldInvoice({ paymentHash, amountMsat, expirySeconds, memo }) {
    if (!/^[0-9a-f]{64}$/.test(paymentHash || '')) {
      throw new Error('paymentHash must be 64 lowercase hex characters');
    }
    if (!Number.isInteger(amountMsat) || amountMsat <= 0) {
      throw new Error('amountMsat must be a positive whole number');
    }
    if (!Number.isInteger(expirySeconds) || expirySeconds <= 0) {
      throw new Error('expirySeconds must be a positive whole number');
    }
    if (this.invoices.has(paymentHash)) {
      throw new Error('an invoice with this paymentHash already exists');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;
    this.invoices.set(paymentHash, {
      amountMsat,
      memo: memo || '',
      expiresAt,
      state: 'open',
      waiters: []
    });

    return { bolt11: `lnbcFAKEHOLDINVOICE${paymentHash}`, expiresAt };
  }

  async waitUntilHeld({ paymentHash, timeoutMs }) {
    const inv = this._get(paymentHash);
    const now = Math.floor(Date.now() / 1000);

    if (inv.state === 'held') return { state: HOLD_STATES.HELD, amountMsat: inv.amountMsat };
    if (inv.state === 'cancelled') return { state: HOLD_STATES.CANCELLED };
    if (inv.state === 'settled') throw new Error('invoice is already settled');
    if (now >= inv.expiresAt) return { state: HOLD_STATES.EXPIRED };

    // Wait until the payment arrives, the invoice is cancelled, or the
    // earlier of the invoice expiry and the optional timeout is reached.
    const untilExpiryMs = (inv.expiresAt - now) * 1000;
    const waitMs = timeoutMs ? Math.min(timeoutMs, untilExpiryMs) : untilExpiryMs;

    return new Promise((resolve) => {
      const waiter = { resolve: null, timer: null };
      waiter.resolve = (result) => {
        clearTimeout(waiter.timer);
        resolve(result);
      };
      waiter.timer = setTimeout(() => {
        inv.waiters = inv.waiters.filter((w) => w !== waiter);
        resolve({ state: HOLD_STATES.EXPIRED });
      }, waitMs);
      inv.waiters.push(waiter);
    });
  }

  async settle({ preimage }) {
    if (!/^[0-9a-f]{64}$/.test(preimage || '')) {
      throw new Error('preimage must be 64 lowercase hex characters');
    }
    const inv = this._get(hashOfPreimage(preimage));
    if (inv.state !== 'held') {
      throw new Error(`cannot settle an invoice in state "${inv.state}"`);
    }
    inv.state = 'settled';
    return { settled: true };
  }

  async cancel({ paymentHash }) {
    const inv = this._get(paymentHash);
    if (inv.state === 'settled') {
      throw new Error('cannot cancel a settled invoice');
    }
    if (inv.state !== 'cancelled') {
      inv.state = 'cancelled';
      this._wake(inv, { state: HOLD_STATES.CANCELLED });
    }
    return { cancelled: true };
  }

  // Test helper, not part of the interface: pretend the wallet paid.
  simulateIncomingPayment(paymentHash, amountMsat) {
    const inv = this._get(paymentHash);
    const now = Math.floor(Date.now() / 1000);
    if (inv.state !== 'open') throw new Error(`invoice is not open (state "${inv.state}")`);
    if (now >= inv.expiresAt) throw new Error('invoice has expired');
    if (amountMsat !== inv.amountMsat) throw new Error('amount does not match the invoice');
    inv.state = 'held';
    this._wake(inv, { state: HOLD_STATES.HELD, amountMsat: inv.amountMsat });
  }

  _get(paymentHash) {
    const inv = this.invoices.get(paymentHash);
    if (!inv) throw new Error('unknown paymentHash');
    return inv;
  }

  _wake(inv, result) {
    const waiters = inv.waiters;
    inv.waiters = [];
    waiters.forEach((w) => w.resolve(result));
  }
}

module.exports = { MemoryBackend, hashOfPreimage };
