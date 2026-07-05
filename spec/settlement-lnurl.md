# Off-Ramp Settlement Profile — LNURL (v0.2 — Draft)

> **Status:** Draft for alliance feedback. Scope: **off-ramp only** (Bitcoin → mobile money / fiat). On-ramp is out of scope (see below).

## Motivation

Discovery finds a provider and attestation ranks it. Settlement — actually moving value — is still up to the two parties. The [standard settlement API](settlement-api.md) defines a bespoke REST flow for that, but it requires each wallet to integrate against it.

This profile defines settlement over **LNURL**, which wallets in the Nostr/Lightning ecosystem already speak. A wallet that supports Lightning Addresses can pay a conformant provider it has never seen before, the moment discovery surfaces it — no per-provider integration. It turns the N×M integration problem (every wallet × every provider) into N+M (everyone speaks one standard).

This profile does not replace a provider's server; it standardises its shape. A Lightning Address still resolves to an HTTPS endpoint — the point is that every conformant provider exposes the *same* endpoint shape.

## Scope: off-ramp only

LNURL-pay is a *push to an invoice*: the payer sends sats. Off-ramp fits this exactly — the wallet pushes Bitcoin, the provider delivers fiat. On-ramp (fiat → Bitcoin) is the reverse and would require an LNURL-withdraw flow whose fiat-first sequencing carries different trust properties; it is deliberately excluded from this profile and left to a separate mechanism.

## The destination address

The payout target is encoded as a **Lightning Address** (LUD-16):

```
<payout-target>@<provider-domain>
```

For mobile-money off-ramp, the username is the **recipient's phone number** in the payout country's format (E.164 without `+`, or the local MSISDN the provider documents). Example: `255744000000@example.com`.

The wallet resolves it the standard way — `GET https://example.com/.well-known/lnurlp/255744000000` — and receives a payRequest.

A provider advertises this capability in its service listing (kind 38383):

- `protocols` contains `lnurl` (a claim of conformance to this profile), and
- an optional `lnaddr` tag whose value is a **Lightning Address template** telling wallets how to construct the destination, e.g. `["lnaddr", "{phone}@example.com"]`.

## The flow

```
Wallet                                   Provider
  │                                         │
  ├── GET /.well-known/lnurlp/<phone> ─────►│   Resolve address (LUD-16)
  │◄── payRequest (rate, terms, verify) ────┤   Quote for THIS payout
  │                                         │
  ├── GET <callback>?amount=<msat> ────────►│   Request invoice
  │◄── { pr, payoutAmount, verify } ────────┤   Hold invoice + payout terms
  │                                         │
  ├── (pay the bolt11 invoice) ────────────►│   Provider HOLDS the payment
  │                                         │   ├─ deliver fiat to <phone>
  │                                         │   ├─ on success → settle hold
  │                                         │   └─ on failure → cancel hold (auto-refund)
  │                                         │
  ├── GET <verify> ───────────────────────►│   Poll delivery status (LUD-21)
  │◄── { settled, status } ─────────────────┤   pending/processing/completed/failed
```

## The rate, at pay-time

The discovery listing advertises a fee *range*. The exact sats→fiat quote for a specific payout appears in the payRequest / callback response, so a wallet can show the user "you will receive X" before they pay.

Recommended fields on the callback response (in addition to LUD-06's `pr`):

| Field | Meaning |
|-------|---------|
| `payoutCurrency` | ISO 4217 code of the fiat delivered (e.g. `TZS`) |
| `payoutAmount` | Exact fiat the recipient receives for this invoice, as a decimal string |
| `feeTotal` | Total fee already reflected in the quote (transparency) |
| `verify` | LUD-21 verify URL for this payment |
| `rateExpiry` | Unix seconds after which the quote is void |

Wallets SHOULD display `payoutAmount` + `payoutCurrency` to the user before payment and treat the quote as void after `rateExpiry`.

## Hold invoice — REQUIRED

A conformant provider **MUST** use a **hold invoice** for the Lightning leg. The provider:

1. Returns a hold invoice from the callback.
2. Accepts the incoming HTLC but does **not** settle it yet.
3. Attempts the fiat payout.
4. **On confirmed delivery**, settles the hold invoice (captures the sats).
5. **On failed or undeliverable payout**, cancels the hold invoice — the sats return to the payer automatically.

This is the safety core of the profile. Naive LNURL-pay captures sats the instant the invoice is paid; if the fiat payout then fails, the payer has lost irreversible Bitcoin with no clean refund path. Hold invoices make Lightning settlement *contingent on* fiat delivery, so a failed off-ramp is a non-event for the payer.

Because a trust-ranked directory implies "listed means safe to pay," capture-on-pay off-ramps do not conform to this profile.

## Delivery confirmation (LUD-21, extended meaning)

The profile uses the LUD-21 `verify` endpoint to report **fiat delivery** status, not merely Lightning settlement. The verify response maps to the shared status vocabulary from the [settlement API](settlement-api.md):

| verify state | Meaning |
|--------------|---------|
| `pending` | Invoice not yet paid |
| `processing` | Sats held; fiat disbursement in progress |
| `completed` | Fiat delivered; hold settled |
| `failed` | Payout failed; hold cancelled; sats refunded |

A wallet polls `verify` until a terminal state (`completed` / `failed`), rather than assuming success on Lightning payment alone.

## Conformance

A provider conforms to this profile when it:

- Serves a Lightning Address (LUD-16) whose username is the payout target.
- Returns a payRequest with the recommended payout fields above.
- Uses a **hold invoice** contingent on fiat delivery (REQUIRED).
- Exposes an LUD-21 `verify` endpoint reporting fiat-delivery status.
- Advertises `lnurl` in its listing's `protocols`.

Conformance is a **profile a provider opts into**, not a requirement to be listed. Non-conformant providers remain discoverable but require bespoke integration; conformant providers are payable by any LNURL-capable wallet with none.

## Security considerations

- A wallet resolving `<phone>@<domain>` fetches an attacker-influenced URL. Wallets MUST require `https`, and SHOULD validate the resolved host against private/reserved ranges (see the discovery library's SSRF guard) before fetching.
- Wallets MUST verify the bolt11 invoice amount matches the quoted sats before paying.
- `payoutAmount` is provider-asserted; wallets SHOULD surface it as "provider quote," and the LUD-21 terminal state — not the Lightning payment — is the source of truth for whether fiat was delivered.
