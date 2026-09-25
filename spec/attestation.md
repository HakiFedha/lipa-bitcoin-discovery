# Attestation Model

How trust works in the service discovery protocol.

## Overview

Discovery surfaces candidates. Attestation ranks and filters them. The two are inseparable: discovery without trust is a spam list, trust without discovery is just your phone contacts.

## How attestations work

An attestation is a signed Nostr event (kind 38384) where one provider vouches for another. Attestations are one-directional, public, signed, and replaceable.

## Trust scoring

| Source | Weight | Rationale |
|--------|--------|-----------|
| Designated anchor attestation | +3 (suggested default) | A pubkey the consuming application chooses to treat as a trust anchor |
| Provider attestation (recognised key) | +1 | Peer trust |
| Provider attestation (unrecognised key) | 0 | Sybil resistance |
| Active revocation (kind 38385) | -10 (suggested default) | Effectively removes from results |

These weights are a reference default, not a protocol requirement. The protocol does not define who must operate a trust anchor or what weight it should carry, each application or community sets its own policy.

### Deterministic algorithm

Given a chosen set of trust-anchor pubkeys and weights, every client MUST compute scores identically:

1. Fetch kind-38384 (attestations) and kind-38385 (revocations) where the `p` tag is the target.
2. Verify each signature; discard failures.
3. Keep events whose `p` equals the target; discard attestation self-vouches.
4. Deduplicate by author, keeping each author's most recent event, one key counts once.
5. Tier each author: ANCHOR (a designated anchor pubkey) → anchor weight, PROVIDER (recognised) → +1, UNKNOWN → 0.
6. `score = Σ attestation_weights − (recognised_revocations × revocation_weight)`. Revocations from unknown keys are ignored.

Display class: `score ≥ 5` trusted, `≥ 1` reliable, `≤ 0` risky. These thresholds are also reference defaults, adjustable per application.

## Sybil resistance

Only attestations from recognised keys carry weight. A key is "recognised" if the consuming application designates it as a trust anchor, or if it is a provider that itself has attestations from recognised keys. This creates a chain of trust rooted in keys the application chooses to trust, not in a protocol-defined authority.

## Trust weight is a consumer-side policy

The protocol does not mandate who operates a trust anchor, what weight an anchor's attestation carries, or how that weight should change over time. An application, wallet, or directory may designate one or more anchors of its own choosing (including none), assign its own weights, and adjust them as it sees fit. There is no protocol-wide bootstrap schedule, dominance phase, or maturity timeline, that would concentrate authority in whoever operates the anchor, which the protocol is designed to avoid.

## Revocations (kind 38385)

### Who can revoke
Any key can publish a revocation event referencing its own prior attestation. There is no protocol-defined body with authority to revoke another participant's attestation on their behalf. If an application chooses to treat a particular anchor's revocations as carrying extra weight, that is the application's own policy, not a protocol rule.

### No anonymous negative attestations
On-protocol negative attestations are not supported, too easy to abuse. Disputes and complaints are handled off-protocol, through whatever process the application, directory, or community involved chooses to run. The protocol itself defines no complaint or appeals process.

## Dispute resolution

### Wallet-side tracking
Wallets can track success/failure rates per provider locally. Private and ungameable, and requires no protocol-level mechanism.

### Off-protocol processes
Beyond local tracking, resolving disputes, complaints, investigations, downgrades, appeals, is left to whichever application, directory, or community the parties are using. The protocol does not define who runs this process or what authority it has.
