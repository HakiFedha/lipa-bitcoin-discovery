# NIP-XXXXX: Lipa Bitcoin Service Discovery Protocol

`draft` `optional`

## Abstract

This NIP defines three event kinds for discovering, attesting, and revoking trust in Bitcoin payment services across Africa. Providers publish signed service listings to Nostr relays. Consumers (wallets, apps) query relays to find providers matching their needs. Attestations from other providers establish a web of trust.

## Motivation

Cross-border Bitcoin payments in Africa require off-ramps and on-ramps that bridge Lightning/on-chain to local mobile money systems (M-Pesa, MTN MoMo, Airtel Money, etc). Today, discovering these services is manual and relationship-bound. This NIP creates a permissionless, decentralised directory.

## Event kinds

### Kind 38383: Service listing

A parameterized replaceable event (NIP-33) where a provider advertises its payment capabilities.

**Required tags:**

The five filterable fields use single-letter tags so relays index them for server-side filtering. The rest are display tags read from the fetched event.

| Tag | Description | Filterable | Example |
|-----|-------------|-----------|---------|
| `d` | Unique service identifier | — | `provider-a-tz-offramp` |
| `alt` | NIP-31 human description | — | `Lipa Bitcoin service listing` |
| `v` | Protocol version | — | `0.3` |
| `c` | Country (ISO 3166-1 alpha-2) | yes | `TZ` |
| `o` | Direction of value flow from the customer's perspective | yes | `off-ramp` / `on-ramp` / `both` |
| `i` | Inbound rail | yes | `lightning` / `on-chain` / `ecash` |
| `m` | Outbound rail | yes | `m-pesa` / `mtn-momo` / `airtel-money` / `bank` / `cash` |
| `f` | Fiat currency (ISO 4217) | yes | `TZS` |
| `name` | Human-readable provider name | — | `Provider A` |
| `endpoint` | API base URL | — | `https://api.example.com` |
| `health` | Liveness check URL | — | `https://api.example.com/health` |
| `status` | Current status | — | `active` / `maintenance` / `offline` |

**Optional tags:**

| Tag | Description | Example |
|-----|-------------|---------|
| `network` | Mobile network operator | `vodacom-tz` |
| `min_amount` | Minimum in local currency | `2500` |
| `max_amount` | Maximum in local currency | `1000000` |
| `fee_range` | Fee percentage range | `1.5-2.2` |
| `speed` | Settlement speed | `seconds` / `minutes` / `hours` |
| `ttl` | Seconds until stale | `90000` (25 hours) |
| `protocols` | Supported Lightning protocols | `bolt11,nwc,lnurl` |
| `kyc` | KYC requirement level | `none` / `light` / `full` |

**Liveness:** Providers SHOULD republish only on change (fee, status, rail, endpoint). Consumers SHOULD treat listings older than `ttl` as stale and use the `/health` endpoint as the real-time liveness signal. There is no fixed-interval heartbeat: replaceable events plus a health endpoint make periodic re-publishing redundant.

### Kind 38384: Attestation

A parameterized replaceable event where one provider vouches for another.

| Tag | Description | Example |
|-----|-------------|---------|
| `d` | Unique attestation ID | `vouch-3bf0c63fcb934634` |
| `alt` | NIP-31 human description | `Lipa Bitcoin provider attestation (vouch)` |
| `v` | Protocol version | `0.3` |
| `p` | Hex pubkey of provider being vouched for | `3bf0c63f…459d` (64-char hex) |
| `rating` | Trust level | `reliable` / `verified` / `trusted` |
| `since` | Relationship start | `2026-01` |
| `volume` | Transaction volume (general) | `low` / `medium` / `high` |
| `note` | Human-readable context | `Processed cross-border flows reliably` |

### Kind 38385: Revocation

An event that withdraws trust from a provider.

| Tag | Description | Example |
|-----|-------------|---------|
| `d` | Unique revocation ID | `revoke-deadbeefdeadbeef` |
| `alt` | NIP-31 human description | `Lipa Bitcoin provider trust revocation` |
| `v` | Protocol version | `0.3` |
| `p` | Hex pubkey of provider being revoked | `deadbeef…beef` (64-char hex) |
| `action` | Action taken | `revoked` / `suspended` |
| `reason` | Human-readable reason | `Non-delivery of mobile money payouts` |
| `effective` | Effective date | `2026-09-15` |

> All `p` tag values are lowercase 64-char hex per NIP-01. `npub…` is a display encoding only and never appears in tags.

## Query flow

1. Consumer sends a REQ filter to relays using single-letter tags for server-side matching:

```json
{ "kinds": [38383], "#c": ["TZ"], "#o": ["off-ramp"], "#m": ["m-pesa"], "limit": 500 }
```

The relay performs the AND match server-side, so the consumer does not download the entire kind-38383 population. This also excludes other protocols sharing kind 38383 (e.g. Mostro), since their events lack a `c` tag.

2. Relay returns matching service listings
3. Consumer fetches attestations for each result (`{ "kinds": [38384], "#p": ["<hex-pubkey>"] }`)
4. Consumer checks for revocations (`{ "kinds": [38385], "#p": ["<hex-pubkey>"] }`)
5. Consumer may evaluate results using its own trust policy, service requirements, speed, fee range, and other application-specific criteria
6. Consumer may check a suitable provider's `/health` endpoint
7. If the provider meets the consumer's requirements, the consumer connects to the provider using the advertised interaction mechanism

## Public listing data

Lipa service listings are public discovery metadata. A listing MUST NOT contain private credentials, API keys, authentication tokens, private keys, passwords, customer personal information, customer transaction data, KYC documents, or other confidential information.

Credentials and other sensitive information required to interact with a provider MUST be handled through the provider's own secure authentication mechanism and MUST NOT be published through Lipa Discovery.

Providers should publish only information they are comfortable making publicly discoverable.

## Content field

Kind 38383 carries optional extended metadata as a JSON object in `content` (see the data-model reference for the key schema: `description`, `website`, `support`, `logo` — all optional, unknown keys preserved), or `{}` if none. Kinds 38384 and 38385 use an empty `content` string.

## Versioning

Every event carries a `v` tag.

- `v: "0.3"` — current schema, including `service_type`/`product` and the single-letter filter tags `c/o/i/m/f`.
- **Missing `v` tag** — treat as `0.1`, the original draft that used multi-letter filter tags (`country`, `direction`, `rail_out`, …). 0.1 is deprecated; the reference library no longer emits or filters it.
- **Unknown `v`** (newer than the client understands) — the client SHOULD show a warning, still render the listing using the tags it recognises, and MUST NOT crash on unexpected tags.

Clients reject nothing solely on version; they degrade gracefully and surface uncertainty to the user.

## Provider-to-provider routing

Providers are also consumers. Provider A (Tanzania) can query the directory to find Provider B (Kenya) and route cross-border payments. The query flow is identical. The standard settlement API (future NIP) enables providers to interoperate without custom integrations.

## Health endpoint

Every provider SHOULD expose a health endpoint returning: status, uptime, average speed, capacity (available/limited/full), and protocol version.

## Trust signals

Attestations and revocations are public trust signals that applications may use when evaluating discovered services.

Lipa Bitcoin Discovery does not require one universal trust score or ranking algorithm. A wallet, application, provider, directory, or other consumer MAY apply its own trust policy based on attestations, revocations, recent activity, external verification, transaction history, service requirements, or other relevant signals.

Applications SHOULD distinguish discovery from trust. A provider being discoverable does not by itself mean that the provider is trusted or suitable for a particular transaction.

## Privacy considerations

Fee ranges not exact fees. Amount ranges not real-time liquidity. No transaction volume in listings. Health endpoint returns capacity levels not dollar amounts.

## Security considerations

All listing, attestation, and revocation events come from untrusted publishers. Consumers MUST:

- **Verify every event signature** before treating the event's author as authentic or using the event as a trust signal.
- **Treat all free-text fields as untrusted** — `name`, `note`, `reason`, and any `content` metadata. Escape them before rendering in a UI to avoid injection (e.g. stored XSS in a web client).
- **Validate `health`/`endpoint` URLs before fetching.** They are attacker-controlled; a naive fetch enables SSRF. Require https and reject private/reserved addresses (loopback, RFC 1918, link-local/metadata `169.254.0.0/16`, and the IPv6 equivalents including IPv4-mapped/NAT64/6to4 forms). Cap response size and bound concurrency.

The reference library (`lib/`) implements all three.

## Settlement

Settlement is explicitly out of scope. A standard settlement API is planned for a future NIP.
