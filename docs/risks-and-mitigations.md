# Known Risks and Mitigations

Five architectural risks identified during the design of the protocol, with proposed mitigations.

## Risk 1: Cold start problem (HIGH)

**Problem:** The protocol needs both providers AND wallets to adopt. If no wallet queries, providers won't publish. If no providers publish, wallets won't integrate.

**Mitigation:** Launch with a single corridor between two countries and a single wallet partner. One corridor, one demo, then expand.

**Decision needed:** Which corridor and wallet partner does the project launch with first?

## Risk 2: Settlement is out of scope (MEDIUM)

**Problem:** Discovery introduces parties, but every provider has a different API. A wallet must do separate integrations for each provider. This doesn't scale.

**Mitigation:** Define a standard settlement API (v0.2) with four endpoints: `/v1/quote`, `/v1/execute` (via Lightning invoice), `/v1/status`, `/v1/providers`. See [settlement-api.md](../spec/settlement-api.md) for the draft.

**Decision needed:** Should the settlement API be drafted in parallel with v0.1 discovery implementation?

## Risk 3: Heartbeat bandwidth at scale (LOW)

**Problem:** 30-minute heartbeats from 200+ providers = 9,600+ events per day per relay. Mostly identical data.

**Mitigation:** Change to daily keepalive + publish-on-change. TTL extends to 25 hours. Health endpoint handles real-time liveness. Cuts traffic by ~95%.

**Decision needed:** 30-minute heartbeat (simpler) or daily keepalive (efficient)?

## Risk 4: Trust centralisation (MEDIUM)

**Problem:** If a single anchor's attestation carries far more weight than others, whoever operates that anchor could dominate trust scores across the ecosystem.

**Mitigation:** The protocol does not designate a default anchor or mandate its weight. Trust-anchor selection and weighting are consumer-side policy: each application, wallet, or directory chooses its own anchor(s), if any, and sets its own weights. No protocol-wide bootstrap schedule concentrates trust in one operator by design.

**Decision needed:** None at the protocol level. Individual applications may still choose to document their own anchor policy for their users.

## Risk 5: Dispute resolution (HIGH)

**Problem:** A provider takes Lightning payment but doesn't deliver mobile money. No mechanism to flag bad actors.

**Mitigation:** Layered approach:
1. **Hold invoices (LNURL settlement profile)** — for providers conforming to the [LNURL settlement profile](../spec/settlement-lnurl.md), sats are held, not captured, until fiat delivery is confirmed; a failed payout auto-refunds the payer. This prevents the described failure mode structurally, for conformant providers. Conformance is optional and not yet implemented in the reference library, it's a specified (draft) profile a provider can opt into.
2. **Wallet-side tracking** — wallets track success rates locally, deprioritise unreliable providers. Covers non-conformant providers and any residual failures.
3. **Revocation event (kind 38385)** — formal trust withdrawal published on-protocol by any key, in relation to its own prior attestation.

No anonymous negative attestations — too easy for competitors to abuse. Beyond these protocol-level mechanisms, disputes and complaints are handled off-protocol, through whatever process the application, directory, or community involved chooses to run.

**Decision needed:** None at the protocol level for trust/dispute mechanics. Open question: should hold-invoice conformance become a stronger signal in discovery results (e.g. surfaced to wallets) to incentivise adoption?
