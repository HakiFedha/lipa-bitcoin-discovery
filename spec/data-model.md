# Data Model Reference

Reference for the transport-independent service description and its discovery transports.

This document defines the transport-independent service description used by Lipa Bitcoin Discovery.

The service description answers: What does this provider offer?

Discovery answers: How can software find this service description?

The same service description may be discovered through Nostr, HTTP/API, a directory, or another transport. Transports may encode and index fields differently, but they should describe the same underlying service.

## 1. Canonical Service Description

The canonical service description is transport-independent. It describes what a provider offers independently of how applications discover it.

## 2. Service Description Fields

The fields below describe the service itself. Transport-specific representations are documented separately.

### Core Fields

`id` - Stable identifier for the service listing.

`provider` - Human-readable provider information, including the provider name.

`countries` - Countries where the service operates, using ISO 3166-1 alpha-2 country codes.

`directions` - Direction of value flow from the customer's perspective: `on-ramp` means the customer provides non-Bitcoin value and receives Bitcoin; `off-ramp` means the customer provides Bitcoin and receives non-Bitcoin value or a service; `both` means the service supports both directions.

`service_type` - The kind of service being offered: `currency-exchange` (buying or selling Bitcoin for fiat currency), `remittance` (Bitcoin sent by one party, fiat delivered to a different recipient), `airtime-data` (Bitcoin converted directly into mobile airtime or a data bundle), `bill-payment` (Bitcoin used to settle a bill or subscription), or `merchant-payment` (Bitcoin accepted directly for goods or services). Defaults to `currency-exchange` when absent, so every listing published before this field existed remains valid and correctly described without republishing.

`product` - Optional free-text description of the specific product or destination where a fixed rail vocabulary does not apply, such as a named airtime carrier, a biller, or a merchant category. Not applicable to `currency-exchange`.

`rails` - Payment rails supported by the service. `in` describes the rail used to send value into the service and `out` describes the rail used to receive value from the service. Examples include Lightning, on-chain Bitcoin, ecash, LNURL, mobile money, bank transfers, and cash. `out` is required for `currency-exchange` and `remittance` service types, since both genuinely deliver fiat through a payment rail. It is optional for `airtime-data`, `bill-payment`, and `merchant-payment`, where Bitcoin may settle the obligation directly with no fiat rail involved.

`currencies` - Fiat or other currencies supported by the service, using ISO 4217 codes where applicable.

`endpoint` - Endpoint where an application can interact with the service. This is a service endpoint, not a discovery endpoint.

`health` - Optional endpoint that can be used to check whether the provider service is responding. A successful health response does not guarantee that a transaction will succeed.

`status` - Current service status, such as `active`, `inactive`, or `maintenance`.

`network` - Bitcoin network or environment supported by the service, such as `mainnet` or `testnet`.

`min_amount` and `max_amount` - Minimum and maximum supported transaction amounts.

`fee_range` - Information about applicable fees. The representation may vary by provider.

`speed` - Informational indication of expected service or settlement speed.

`protocols` - Protocols supported by the service, such as LNURL.

`lnaddr` - Lightning address or related Lightning identifier where applicable.

`kyc` - Information about whether identity verification is required, for example `none`, `required`, or `conditional`.

`ttl` - Optional freshness period for the service description. It helps applications determine when a listing may be stale and does not replace health checks or other liveness signals.


## 2.1. Public Listing Data

Lipa service descriptions are public discovery metadata. They MUST NOT contain private credentials, API keys, authentication tokens, private keys, passwords, customer personal information, customer transaction data, KYC documents, or other confidential information.

Credentials and other sensitive information required to interact with a provider MUST be handled through the provider's own secure authentication mechanism and MUST NOT be published through Lipa Discovery.

Providers should publish only information they are comfortable making publicly discoverable.

## 2.2. Discovery Query Model

Discovery queries are transport-independent. They allow an application to ask for services matching criteria such as country, direction, payment rail, currency, KYC requirements, status, or network.

Common query fields include countries, directions, service_type, rails, currencies, kyc, status, and network.

A transport may support only some filtering operations remotely. When necessary, a client may retrieve a broader result set and apply additional filtering locally.

The meaning of a query should remain consistent across discovery transports.

## 2.3. Freshness And Liveness

Discovery does not require a universal heartbeat mechanism. Providers should update their service descriptions when important information changes.

The ttl field may define a freshness boundary. A health endpoint can provide a more immediate liveness signal where available. Recent transaction activity may provide another signal of recent use.

These signals are distinct and should not be treated as proof that a provider is reliable or that a transaction will succeed.

## 2.4. Trust Signals

Trust is separate from basic discovery. Applications may consider signals such as attestations, revocations, recent activity, transaction history, external verification, reputation, or application-specific policy.

Lipa Bitcoin Discovery does not require one universal trust score. Different applications may evaluate the same discovery result differently according to their own risk model.

## 3. Nostr Reference Transport

The current Nostr reference transport uses event kind `38383` for service listings.

### Nostr Tag Indexing

Nostr-specific filtering uses single-letter tags for the fields that need server-side filtering. This is a property of the Nostr transport, not a requirement of the Lipa Bitcoin Discovery data model. Other transports may represent and filter these fields differently.

| Field | Tag | Filterable |
|-------|-----|-----------|
| country | `c` | yes (server-side) |
| direction | `o` | yes (server-side) |
| service_type | `s` | yes (server-side) |
| rail_in | `i` | yes (server-side) |
| rail_out | `m` | yes (server-side) |
| currency | `f` | yes (server-side) |

All other tags below are display/metadata and are not used in relay filters.

### Required tags

#### `d` - Service identifier
Unique identifier for this service listing. Format: `{provider}-{country}-{direction}`

#### `alt` - Human description (NIP-31)
Always `Lipa Bitcoin service listing`. Lets generic Nostr clients render the event meaningfully.

#### `v` - Data model version
Version of the canonical service description represented by this Nostr listing. Clients may warn or reject on unsupported versions. Current version: `0.3`, which added `service_type`/`product`. A `0.2` listing is a valid `currency-exchange` listing under `0.3` and does not need to be republished.

#### `c` - Country code (filterable)
ISO 3166-1 alpha-2, uppercase. Common values: `TZ`, `KE`, `NG`, `GH`, `ZA`, `UG`, `ZM`, `RW`. The Nostr transport represents multiple countries by publishing a separate listing for each country. This is a transport-specific encoding of the canonical `countries` field.

#### `o` - Service direction (filterable)
`off-ramp` (Bitcoin → fiat), `on-ramp` (fiat → Bitcoin), `both`

#### `s` - Service type (filterable)
`currency-exchange`, `remittance`, `airtime-data`, `bill-payment`, `merchant-payment`. Absent means `currency-exchange`, so listings published before this tag existed remain valid without republishing.

#### `i` - Inbound payment rail (filterable)
`lightning`, `on-chain`, `ecash`, `lnurl`

#### `m` - Outbound payment rail (filterable)
`m-pesa`, `mtn-momo`, `airtel-money`, `orange-money`, `bank`, `cash`

#### `f` - Fiat currency (filterable)
ISO 4217, uppercase. Common values: `TZS`, `KES`, `NGN`, `GHS`, `ZAR`, `UGX`, `ZMW`, `RWF`

#### `name` - Provider name
Human-readable provider name. This represents the provider name within the canonical `provider` field.

#### `endpoint` - Service endpoint
HTTPS URL where the provider's API is reachable.

#### `health` - Health check URL
HTTPS URL that returns liveness information.

#### `status` - Current status
`active` (operational), `maintenance` (temporarily unavailable), `offline` (not operational)

### Optional tags

#### `network` - Bitcoin network or environment
Examples: `mainnet`, `testnet`
#### `mobile_network` - Mobile network operator
Examples: `vodacom-tz`, `safaricom-ke`, `mtn-ng`, `airtel-ug`

#### `min_amount` / `max_amount` - Transaction limits
In local currency (as strings).

#### `fee_range` - Fee percentage
Range to protect competitive information. Example: `1.5-2.2`

#### `speed` - Settlement speed
`seconds` (< 60s), `minutes` (1–30 min), `hours` (30 min to 24 hours)

#### `ttl` - Time to live
Default: `90000` (25 hours)

#### `protocols` - Lightning protocol support
Comma-separated: `bolt11`, `bolt12`, `nwc`, `lnurl`, `webln`, `keysend`

Including `lnurl` indicates that the provider supports LNURL. Details of settlement behaviour are defined separately from discovery.

#### `lnaddr` - Lightning Address template (optional)
A Lightning Address or address template where applicable. For example, `{phone}@example.com` can indicate that the username is the recipient phone number. Applications may use this information to determine how a payment destination can be constructed.

#### `kyc` - KYC requirements
`none`, `light` (phone number), `full` (government ID)

#### `product` - Specific product or destination (optional)
Free text identifying the specific airtime carrier, biller, or merchant category when `s` is `airtime-data`, `bill-payment`, or `merchant-payment`. Not applicable to `currency-exchange`.

> **Liveness has no heartbeat tag.** Providers SHOULD republish only on change (fee, status, rail, endpoint). `ttl` bounds how long a listing is considered fresh; a `/health` endpoint can provide a current liveness indication when queried. There is no fixed-interval heartbeat - it would waste relay bandwidth without improving liveness.

### Content Field

`content` for kind 38383 is a JSON object of optional extended metadata. All keys are optional; unknown keys SHOULD be preserved by consumers but MAY be ignored. Use `{}` when there is nothing to add.

| Key | Type | Meaning |
|-----|------|---------|
| `description` | string | Human-readable service description |
| `website` | string | Provider homepage (https URL) |
| `support` | string | Support contact (email, https URL, or `nostr:` npub) |
| `logo` | string | Logo URL (https; square, ≤512px recommended) |

Kinds 38384 (attestation) and 38385 (revocation) use an empty `content` string `""`.

### Attestation Tags (kind 38384)

Required: `d` (replaceable id), `alt` (`Lipa Bitcoin provider attestation (vouch)`), `v` (`0.3`), `p` (target provider pubkey - **64-char hex, not npub**), `rating`. The rating is a transport-specific trust signal and is not a universal Lipa Bitcoin Discovery trust score.
Optional: `since`, `volume`, `note`.

### Revocation Tags (kind 38385)

Required: `d`, `alt` (`Lipa Bitcoin provider trust revocation`), `v` (`0.3`), `p` (target pubkey - **64-char hex**), `action` (`revoked`), `reason`.
Optional: `effective`.

> Pubkeys in `p` tags are always lowercase 64-char hex per NIP-01. `npub…` is a display encoding only and must never appear in a tag value.

## 4. Discovery Transports Beyond Nostr

### 4.1. HTTP/API Transport

HTTP/API is a discovery transport exposing `GET /v1/services` and `GET /v1/health` as a read-through cache over Nostr.

### 4.2. Provider-Hosted Transport (`/.well-known/lipa`)

Provider-hosted discovery allows a provider to host its own service discovery document directly at `GET /.well-known/lipa`.

#### Document Format

A provider-hosted discovery document is a JSON object with the following top-level fields:

- `protocol` (string, required): Protocol identifier. MUST be `"lipa"`.
- `version` (string, required): Protocol data model version (e.g. `"0.3"`).
- `provider` (object, required):
  - `name` (string, required): Human-readable provider name.
  - `pubkey` (string, optional): 64-character hex Nostr public key identifying the provider.
- `services` (array, required): List of service descriptions offered by the provider.

#### Service Description Objects

Each object in the `services` array represents a service listing using the canonical service description fields defined in Section 2:

- `id` (string, required): Stable service identifier.
- `countries` (array of strings, required): ISO 3166-1 alpha-2 country codes where the service operates.
- `direction` (string, required): `"on-ramp"`, `"off-ramp"`, or `"both"`.
- `service_type` (string, optional): Service category (`"currency-exchange"`, `"remittance"`, `"airtime-data"`, `"bill-payment"`, `"merchant-payment"`). Defaults to `"currency-exchange"`.
- `product` (string, optional): Description of specific product or carrier.
- `rails` (object, required):
  - `in` (array of strings, required): Inbound payment rails.
  - `out` (array of strings, required for exchange/remittance): Outbound payment rails.
- `currencies` (array of strings, required): ISO 4217 currency codes supported.
- `status` (string, required): `"active"`, `"inactive"`, or `"paused"`.
- `status_reason` (string, optional): Only meaningful when `status` is `"paused"`. One of `"out_of_float"`, `"maintenance"`, `"regulatory"`, or `"other"`.
- Optional canonical fields: `endpoint`, `health`, `network`, `mobile_network`, `min_amount`, `max_amount`, `fee_range`, `speed`, `protocols`, `lnaddr`, `kyc`, `ttl`.

#### Transport Behavior

- Endpoint path: `GET /.well-known/lipa`
- Content-Type: `application/json`
- CORS: Endpoints MUST include `Access-Control-Allow-Origin: *` to allow web and mobile app discovery.
- Error Handling: Unknown routes or invalid requests MUST return JSON formatted error responses (e.g. `{ "error": "Not Found" }`) with appropriate HTTP status codes.

## 5. Settlement Is Separate

Discovery describes what a service offers and how software can find it. Settlement describes how an actual transaction takes place between parties.

Settlement may involve Lightning, LNURL, on-chain Bitcoin, ecash, mobile money, bank transfers, or cash. These mechanisms are therefore separate from the core discovery protocol.

The settlement specifications in this repository remain separate and should not be treated as required components of discovery.


## 6. Versioning

The canonical data model and individual discovery transports may have separate versions. A transport version describes how the transport represents or retrieves the canonical model. A data model version describes changes to the underlying service description.

Implementations should fail safely when they encounter an unsupported version. Breaking changes should use a new version rather than silently changing the meaning of existing fields.
