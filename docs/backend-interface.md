# Settlement Backend Interface

Status: draft for review. No code has been written against this note yet.

## Purpose

The LNURL settlement profile (spec/settlement-lnurl.md) relies on hold invoices. This note defines the small interface between the settlement logic and whatever Lightning node or wallet service holds the invoice. The settlement logic never talks to LND, Spark or CLN directly. It talks only to this interface.

## Design Rules

- **Backend neutral:** the settlement logic must work with any backend that implements the four methods below.
- **One reference backend first:** LND, tested on regtest, using the invoicesrpc calls AddHoldInvoice, SettleInvoice and CancelInvoice.
- **Waiting is the backend's business:** LND may stream state changes and another backend may poll. The settlement logic cannot tell the difference and does not need to.
- **Plain CommonJS:** the library has no `"type": "module"` field, so new code uses `require` and `module.exports`.
- **Kept separate:** new code lives in its own directory, `lib/src/settlement/`, and is added to `src/index.js` only once the interface is stable.

## The Four Methods

**1. createHoldInvoice**
- Input: payment hash, amount in msat, expiry in seconds, short memo.
- Output: the bolt11 invoice and the time it expires.
- The expiry is how long the wallet has to pay the invoice. It should match the quote's `rateExpiry`, so a wallet cannot pay after the quoted rate has lapsed. It is separate from the HTLC timeout, which governs how long a payment can stay held once it has arrived (see Timing Rule).
- The provider generates the preimage and keeps it secret. Only the hash goes to the backend.

**2. waitUntilHeld**
- Input: payment hash, maximum time to wait.
- Output: one of `held`, `expired` or `cancelled`, plus the amount held.
- Returns when the wallet's payment has arrived and is locked, or when it is clear that it never will.

**3. settle**
- Input: the preimage.
- Effect: the provider claims the sats. Called only after the fiat payout is confirmed.

**4. cancel**
- Input: payment hash.
- Effect: the sats return to the wallet. Called when the payout fails.

## Payout States

The payout record is keyed by payment hash and uses the profile's four status values: `pending`, `processing`, `completed`, `failed`.

- `pending`: invoice created, nothing held yet.
- `processing`: payment is held and the fiat payout has started.
- `completed`: fiat paid out and the hold settled.
- `failed`: payout failed or the hold expired, and the hold was cancelled.

## Timing Rule

The provider must settle or cancel well before the HTLC timeout. The settlement logic enforces a configurable safety margin and cancels automatically if the payout is not confirmed in time. The margin is to be chosen when testing on regtest.

## Error Mapping

Backend problems map to the profile's error codes: `HOLD_EXPIRED` when the hold lapses, `NETWORK_ERROR` when the backend cannot be reached, `PROVIDER_OFFLINE` when the node is down, and `CAPACITY_EXCEEDED` when inbound capacity is too low. `HOLD_EXPIRED` is still open to review in the spec.

## Later Backends

- **Spark:** its own API supports hold invoices with a custom payment hash. Whether Breez exposes this is unconfirmed.
- **CLN:** to be assessed.
- **Blink:** no hold invoice call was found in the documentation read so far. This is not conclusive.

## Open Questions

- Provider answers on whether they can run a hold invoice, and on what, will decide which backend comes second.
- The exact safety margin for settle and cancel.
- Where the preimage is stored between invoice creation and settlement.
