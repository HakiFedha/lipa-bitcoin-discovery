'use strict';

/**
 * Settlement backend interface (see docs/backend-interface.md).
 *
 * The settlement logic talks only to these four methods. Each backend (an
 * in-memory fake for tests, LND, later Spark or CLN) extends this class and
 * implements all four. How a backend waits for a payment (streaming or
 * polling) is its own business.
 */

// Outcomes that waitUntilHeld can report.
const HOLD_STATES = Object.freeze({
  HELD: 'held',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
});

class SettlementBackend {
  /**
   * Create a hold invoice.
   * @param {object} args
   * @param {string} args.paymentHash   64-character hex, sha256 of the preimage
   * @param {number} args.amountMsat    amount in millisatoshis
   * @param {number} args.expirySeconds how long the wallet has to pay (match the quote's rateExpiry)
   * @param {string} args.memo          short description
   * @param {string} [args.descriptionHash] 64-character hex sha256 of the LNURL metadata string.
   *   LNURL wallets check that the invoice carries this hash, so a real backend must put it in
   *   the invoice's description hash field.
   * @returns {Promise<{bolt11: string, expiresAt: number}>} expiresAt is unix seconds
   */
  async createHoldInvoice(args) {
    throw new Error('createHoldInvoice not implemented');
  }

  /**
   * Wait until the wallet's payment has arrived and is held, or it is clear
   * that it never will.
   * @param {object} args
   * @param {string} args.paymentHash
   * @param {number} [args.timeoutMs] optional cap on how long to wait
   * @returns {Promise<{state: 'held'|'expired'|'cancelled', amountMsat?: number}>}
   */
  async waitUntilHeld(args) {
    throw new Error('waitUntilHeld not implemented');
  }

  /**
   * Claim the held sats. Call only after the fiat payout is confirmed.
   * @param {object} args
   * @param {string} args.preimage 64-character hex
   * @returns {Promise<{settled: true}>}
   */
  async settle(args) {
    throw new Error('settle not implemented');
  }

  /**
   * Return the held sats to the wallet. Call when the payout fails.
   * @param {object} args
   * @param {string} args.paymentHash
   * @returns {Promise<{cancelled: true}>}
   */
  async cancel(args) {
    throw new Error('cancel not implemented');
  }
}

module.exports = { SettlementBackend, HOLD_STATES };
