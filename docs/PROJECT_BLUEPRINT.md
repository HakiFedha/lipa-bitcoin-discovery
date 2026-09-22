# Lipa Bitcoin Discovery: Project Blueprint

## 1. Overview

Lipa Bitcoin Discovery is open infrastructure for discovering Bitcoin payment services across Africa.

The project defines a common service description and discovery protocol that allows Bitcoin payment providers, wallets, applications, directories and other software to discover relevant services without requiring a central registration authority.

The core principle is:

> **Discovery is open. Trust is configurable. Settlement is separate.**

The protocol is designed for African payment rails and currencies while remaining extensible to other markets, providers and discovery mechanisms.

Lipa Bitcoin Discovery is transport-independent. Nostr is an initial reference transport, but the protocol does not require Nostr. Other transports, including HTTP APIs and future discovery mechanisms, can carry compatible discovery information.

---

## 2. The Problem We're Solving

Bitcoin payment services across Africa are difficult for software to discover reliably.

A provider may support:

- Lightning
- on-chain Bitcoin
- ecash
- LNURL
- M-Pesa
- MTN Mobile Money
- Airtel Money
- Orange Money
- bank transfers
- cash
- local currencies

But information about these services is often scattered across websites, social media, applications, private relationships and closed integrations.

A human directory can help people find services, but wallets and other applications need machine-readable information that they can query programmatically.

For example, a wallet should be able to ask:

> "Who can help me sell Bitcoin for Tanzanian shillings through M-Pesa?"

and receive relevant service providers without the wallet developer having to know every provider in advance.

Lipa Bitcoin Discovery addresses this gap by defining an open way for services to describe themselves and for software to discover those services.

---

## 3. What We're Building

Lipa Bitcoin Discovery is an open discovery protocol, not a single central directory and not a Nostr-only network.

The protocol has two fundamental parts:

1. **Service Description** — a common way to describe what a provider offers.
2. **Discovery** — mechanisms through which software can find those descriptions.

The same underlying service information should be usable through different discovery transports.

Conceptually:

```text
                    LIPA BITCOIN DISCOVERY
                              │
                     OPEN DISCOVERY PROTOCOL
                              │
              ┌───────────────┴────────────────┐
              │                                │
       SERVICE DESCRIPTION                DISCOVERY
       What does it offer?                How is it found?
                                               │
                                ┌──────────────┼──────────────┐
                                │              │              │
                              Nostr         HTTP/API        Future
                             transport      transport      transports


              ┌──────────────────────────────────────────────┐
              │              SEPARATE CONCERNS                │
              │                                              │
              │  Trust Signals              Settlement       │
              │  Application-configured      Actual           │
              │  trust decisions             transaction      │
              │  and evaluation              between parties  │
              └──────────────────────────────────────────────┘

## 4. Core Concepts

### Service Provider

A service provider is an organisation, business, community service or individual that offers a Bitcoin-related payment service.

A provider may offer one or more combinations of Bitcoin rails, local payment rails, currencies and directions.

### Service Description

A service description is the machine-readable representation of what a provider offers.

It can include:

- provider identity
- service name
- country
- supported currencies
- transaction direction
- Bitcoin rail
- local payment rail
- supported protocols
- limits
- fees
- KYC requirements
- service endpoint
- contact information
- additional metadata

### Discovery Transport

A discovery transport is a mechanism through which a consumer finds service descriptions.

The protocol does not require one transport.

Examples include:

- Nostr
- HTTP/API
- provider-hosted discovery
- directories and indexes
- future decentralised or federated mechanisms

### Consumer

A consumer is software that wants to discover services.

Examples include:

- Bitcoin wallets
- payment applications
- exchanges
- directories
- merchant tools
- other service providers

### Trust Signal

A trust signal is information that helps a consumer evaluate a discovered provider.

Signals may include:

- attestations from other entities
- successful health checks
- recent activity
- external verification
- application-specific reputation
- directory curation

Trust is not a single mandatory score. Different applications may make different trust decisions.

### Settlement

Settlement is the actual transaction between a user and a provider.

Settlement may happen through Lightning, on-chain Bitcoin, ecash, mobile money, bank transfers, cash or another supported rail.

Settlement is outside the core discovery protocol.

## 5. Discovery Transports

The protocol separates the information being discovered from the mechanism used to discover it.

### Nostr

Nostr is the first reference transport.

The current implementation represents service listings and related trust information using Nostr events.

Nostr provides a decentralised way for providers to publish information without requiring a central registration authority.

However, a provider does not need to use Nostr to participate in the wider discovery protocol.

### HTTP/API

An HTTP or API transport can expose compatible service descriptions through ordinary web infrastructure.

This allows wallets and applications that do not use Nostr to participate in discovery.

An API may support queries such as:

- country
- currency
- direction
- Bitcoin rail
- local payment rail
- service type

### Provider-Hosted Discovery

A provider may publish its own service description at a predictable web location.

A future specification could define mechanisms such as a `.well-known` resource for this purpose.

This would allow software to discover information directly from a provider without requiring the provider to register with a central directory.

### Directory and Index

A directory or index can collect and publish service descriptions from multiple providers.

Directories may be:

- centralised
- federated
- community-operated
- curated
- automatically generated

A directory is a discovery mechanism, not the protocol itself.

### Future Transports

The protocol should remain open to additional discovery mechanisms.

New transports should map their data into the common service description rather than creating incompatible provider formats.

## 6. Service Description Data Model

The service description should be sufficiently structured for software to query and compare providers while remaining extensible.

A conceptual representation is:

```text
Provider
 ├── identity
 ├── service_id
 ├── name
 ├── country
 ├── direction
 ├── currencies
 ├── bitcoin_rails
 ├── local_rails
 ├── protocols
 ├── limits
 ├── fees
 ├── kyc
 ├── endpoint
 ├── contact
 └── metadata

## 7. Nostr Reference Implementation

The existing Nostr implementation provides the first working transport for the discovery protocol.

The current reference model uses:

- **Kind 38383** for service listings
- **Kind 38384** for attestations
- **Kind 38385** for revocations

These event kinds describe how the protocol is represented on Nostr. They are not requirements for implementations using other transports.

The Nostr implementation includes components for:

- publishing service listings
- querying listings
- publishing attestations
- recording revocations
- checking provider health
- evaluating trust-related signals

The Nostr transport should remain interoperable with the wider protocol while being replaceable by other discovery transports.

## 8. Trust and Verification

Discovery tells software that a service exists. It does not automatically establish that the service is trustworthy.

Trust should therefore be represented through signals that applications can evaluate according to their own requirements.

Possible signals include:

- attestations from other providers or trusted entities
- successful health checks
- recent service activity
- external verification
- directory curation
- application-specific reputation

A provider may also expose a health endpoint or other mechanism that allows software to check whether the service is currently responding.

A signal such as **Verified Active Recently** should indicate recent observed activity, not guarantee that a provider is safe, solvent or continuously available.

The protocol should not require one universal trust score. Different wallets, directories and applications may have different risk models and therefore different trust requirements.

## 9. Discovery Query Model

Consumers should be able to describe the service they are looking for using common query fields.

A conceptual query may include:

- country
- direction
- currency
- local payment rail
- Bitcoin rail
- service type

For example:

> Find providers in Tanzania that allow a user to sell Bitcoin for TZS through M-Pesa.

A consumer can then use one or more available discovery transports to find matching service descriptions.

The general flow is:

```text
Consumer defines requirements
          │
          ▼
Select available discovery transports
          │
          ▼
Retrieve candidate services
          │
          ▼
Normalise service descriptions
          │
          ▼
Filter by requirements
          │
          ▼
Evaluate trust signals
          │
          ▼
Optionally check current availability
          │
          ▼
Present or use suitable providers
```

This allows the consumer to remain independent of any single discovery mechanism.

## 10. Example Wallet Flow

Consider a person using a Bitcoin wallet who wants to sell Bitcoin for Tanzanian shillings through M-Pesa.

The wallet could construct a discovery query containing:

- country: Tanzania
- currency: TZS
- direction: off-ramp
- Bitcoin rail: Lightning or on-chain
- local rail: M-Pesa

The wallet could then query one or more discovery transports.

It might discover several providers and evaluate their available trust and availability signals.

The wallet can then present suitable providers to the person, who decides which service to use.

The discovery protocol does not require the wallet to become a Nostr application. A wallet could use an HTTP API, a directory, Nostr or another compatible transport.

The protocol also does not require the wallet developer to know every provider in advance.

## 11. Provider-to-Provider Discovery

Providers are also consumers of discovery information.

A provider may need to discover another provider in order to:

- route a customer to another country
- support a currency it does not directly handle
- find a local payment rail
- establish a cross-border relationship
- coordinate liquidity or settlement services

For example, a provider serving users in Zambia may discover a Tanzanian provider that supports TZS and M-Pesa.

This makes discovery useful not only for wallets and end users, but also for interoperability between payment services.


## 12. Lipa Directory and Discovery

The existing Lipa Bitcoin directory and Lipa Bitcoin Discovery serve complementary purposes.

The directory is primarily a human-facing resource. It helps people find and compare Bitcoin services across African markets.

Lipa Bitcoin Discovery is primarily a machine-facing interoperability layer. It allows wallets, applications, providers and other software to discover structured service information programmatically.

The two can therefore exist side by side.

The directory may use discovery data, publish curated service descriptions, or link to providers discovered through the protocol. At the same time, discovery does not depend on the Lipa directory being the central authority.

This distinction is important because a human directory and an open discovery protocol solve different problems.

## 13. Implementation Direction

The existing repository contains a working Nostr-based reference implementation.

The next architectural step is to separate the protocol core from individual discovery transports.

The intended direction is approximately:

```text
lib/
 ├── core/
 │    ├── service-description
 │    ├── query
 │    └── validation
 │
 ├── transports/
 │    ├── nostr/
 │    ├── http/
 │    └── future/
 │
 ├── trust/
 │    └── signals
 │
 └── index.ts

docs/
 ├── protocol/
 ├── examples/
 └── PROJECT_BLUEPRINT.md
```

**Current implementation status:** The repository today still uses the original flat
structure (`lib/src/publisher.js`, `querier.js`, `attestation.js`, `config.js`,
`keys.js`, `index.js`), which is Nostr-specific throughout. The `core/transports/trust`
layout above is the intended direction, not the current state. The split into a
transport-neutral core is planned to happen once an HTTP/API transport exists to
validate the abstraction, rather than being refactored in advance of a second transport.

The exact repository structure may change as the implementation develops. The architectural separation is the important part.

The core should define common service descriptions, queries and validation rules without depending on Nostr-specific libraries.

Each transport should translate between the common protocol model and its own representation.

## 14. Existing Nostr Implementation Findings

The existing implementation has provided useful practical lessons for the protocol design.

### Relay Indexing

Some public Nostr relays may not index custom multi-character tags in a way that makes server-side filtering reliable.

Client-side filtering may therefore be necessary when using certain relays.

### Event Kind Compatibility

The current use of Kind 38383 needs to be treated as a Nostr transport detail because that kind may also be used by other Nostr applications.

The wider protocol should not make the event kind itself part of the universal service identity.

### Provider Identity

A Nostr transport can identify a provider through a Nostr keypair.

Other transports may use different identities, such as HTTPS domains, API credentials, signed documents or directory records.

Provider identity should therefore be transport-aware rather than requiring every provider to have a Nostr identity.

## 15. Current Nostr Implementation

The repository contains a working Nostr reference implementation of the discovery model.

This implementation is important because it provides a tested starting point for the wider transport-independent protocol. Its Nostr-specific behaviour should not be treated as a requirement for other transports.

### Service Listing Fields

The current Nostr service listing can describe fields including:

- provider name
- country
- direction
- `rail_in`
- `rail_out`
- currency
- minimum amount
- maximum amount
- fee range
- speed
- service endpoint

The current African payment examples include Bitcoin rails such as Lightning, on-chain Bitcoin and ecash, and local rails such as M-Pesa, MTN Mobile Money, Airtel Money, bank transfers and cash.

The implementation should expose enough information for discovery while avoiding unnecessary disclosure of sensitive business or personal information.

For example, a fee range can communicate the approximate cost of a service without requiring a provider to publish exact commercial pricing. Capability information can describe what a provider supports without necessarily revealing its current liquidity or capacity.

### Publisher

The `Publisher` component creates and publishes Nostr service-listing events.

It is responsible for:

- building service-listing events
- validating required fields
- normalising country and currency codes
- signing events
- publishing them to configured relays

### Querier

The `Querier` component discovers and evaluates service listings.

Current functionality includes:

- `find()` for filtered discovery
- `findByCountry()` for country queries
- `findOffRamp()` for off-ramp queries
- `findOnRamp()` for on-ramp queries
- `checkHealth()` for provider health checks
- `findHealthy()` for discovery combined with health checks

### Attestation

The `Attestation` component implements the current Nostr trust mechanism.

It supports:

- publishing attestations
- revoking attestations
- retrieving attestations for a provider
- retrieving revocations
- calculating the current implementation's trust score

The current implementation uses:

- Kind 38384 for attestations
- Kind 38385 for revocations

Attestations are signed by the attesting provider. Self-attestation is rejected.

The current scoring model gives weight to recognised providers and configured trust anchors while giving unknown keys no positive trust weight. Unknown-key revocations are also ignored so that an arbitrary identity cannot simply damage another provider's reputation.

This scoring system is an implementation-specific trust mechanism. It is not a mandatory trust model for the wider discovery protocol.

### Health and Recent Activity

The current implementation can query a provider's health endpoint.

A successful health check indicates that the endpoint responded at the time of the check. It does not guarantee that the provider is solvent, trustworthy or continuously available.

A future discovery interface may expose a signal such as **Verified Active Recently** to communicate recent observed activity. Such a signal should always be understood as time-bound evidence rather than a guarantee.

### Current Test Coverage

The repository includes offline and live testing for the Nostr implementation.

The offline tests cover areas including:

- event signatures
- validation and normalisation
- service listings
- attestations
- revocations
- trust-scoring behaviour
- revocation penalties
- Sybil-resistance rules

The live test suite exercises the end-to-end Nostr cycle, including publishing a listing, discovering it, publishing an attestation and retrieving the resulting trust information from public relays.

These tests establish the current state of the Nostr reference implementation. They do not imply that the wider transport-independent protocol is complete.

### Nostr Implementation Constraints

The current implementation has identified several important constraints.

#### Relay Tag Indexing

Public Nostr relays do not reliably provide server-side indexing for arbitrary multi-character tags.

The current service listings therefore use client-side filtering after retrieving relevant events.

This works at the current scale but may require a different indexing strategy as the number of providers grows.

#### Kind 38383 Collision

Kind 38383 is already used by another Nostr protocol, including NIP-69/Mostro.

The current implementation distinguishes its service listings using expected fields such as `name` and `country`.

A future production Nostr transport should consider a dedicated event kind or another robust namespacing mechanism.

#### Attestation Indexing

Attestations and revocations target providers using the single-letter `p` tag.

This allows more efficient server-side filtering than the current multi-character service-listing tags.

These constraints are specific to the Nostr transport and should not limit implementations using HTTP, provider-hosted discovery, directories or other transports.

## 16. Settlement Is Separate

Discovery helps software find a service. It does not perform the transaction itself.

Settlement may involve:

- Lightning
- on-chain Bitcoin
- ecash
- mobile money
- bank transfers
- cash
- other local payment rails

The discovery protocol can describe which settlement rails a provider supports, but the actual exchange, payment, custody and transaction process belongs to the provider and the systems involved in settlement.

Keeping settlement separate prevents the discovery protocol from becoming unnecessarily tied to one payment implementation.

A future settlement API may be developed separately if there is a clear need for interoperability at that layer.


## 17. Security and Abuse Considerations

An open discovery system can be abused even when the underlying protocol is permissionless.

The design should account for:

- spam listings
- false or misleading service descriptions
- Sybil identities
- stale information
- malicious providers
- compromised provider infrastructure
- fraudulent attestations
- privacy risks from excessive metadata

Discovery should therefore be treated as an information layer, not a guarantee of safety.

Applications should evaluate providers according to their own risk models and should avoid presenting discovery information as an endorsement unless they have independently verified it.

The protocol should also minimise unnecessary personal information. A provider should be able to describe a service without being forced to publish sensitive information.

## 18. Build Plan

### Phase 1: Core Protocol

Define the common service description, query model, identifiers, validation rules and transport-neutral terminology.

### Phase 2: Nostr Transport

Maintain and refine the existing Nostr implementation as the first reference transport.

### Phase 3: HTTP/API Transport

Define an HTTP/API representation of the same service descriptions and queries.

### Phase 4: Directory Integration

Allow directories and indexes to consume, publish or curate compatible service descriptions.

### Phase 5: Wallet Integration

Demonstrate discovery from a wallet or payment application using multiple transports where practical.

### Phase 6: Provider-to-Provider Discovery

Demonstrate discovery between payment providers for cross-border routing and interoperability.

### Phase 7: Interoperability

Document how independent implementations can exchange compatible service descriptions and discovery results.

## 19. Repository Direction

The repository should gradually evolve from a Nostr-focused implementation into a transport-independent protocol implementation.

A possible structure is:

```text
lipa-bitcoin-discovery/
 ├── docs/
 │    ├── protocol/
 │    ├── examples/
 │    └── PROJECT_BLUEPRINT.md
 │
 ├── lib/
 │    ├── core/
 │    ├── transports/
 │    │    ├── nostr/
 │    │    └── http/
 │    └── trust/
 │
 ├── examples/
 └── tests/
```

The existing working implementation should be preserved while the protocol boundaries are clarified.

New transports should be added without requiring the core protocol to depend on their specific libraries or infrastructure.

## 20. Who This Is For

Lipa Bitcoin Discovery is intended for:

- Bitcoin payment providers
- wallet developers
- payment applications
- Bitcoin service directories
- exchanges and on/off-ramp services
- cross-border payment providers
- infrastructure developers
- researchers and open-source contributors

It is also intended to benefit people who need to find practical Bitcoin payment services in African markets.

## 21. Project Principles

### Open Discovery

Providers should be able to make their services discoverable without requiring permission from a single central authority.

### Transport Independence

No single network or transport should be mandatory for the protocol as a whole.

### Interoperability

Different discovery mechanisms should describe services using compatible concepts and data structures.

### Configurable Trust

Trust decisions should remain with the applications and communities using the protocol rather than being hard-coded into one universal ranking.

### Settlement Independence

Discovery should not dictate how users and providers ultimately settle transactions.

### African Grounding

The protocol should reflect African payment realities, including mobile money, local currencies, low-bandwidth environments and cross-border payments.

### Extensibility

The design should allow new Bitcoin rails, payment rails, currencies, protocols and discovery transports to be added over time.

## 22. Origin

Lipa Bitcoin Discovery grew from the need to make African Bitcoin payment services easier for software to discover.

The project builds on the original African Bitcoin service discovery work and extends the idea towards a broader, transport-independent discovery protocol.

Nostr remains an important reference implementation because it demonstrates how providers can publish and discover service information without relying on a central registration authority.

The architectural goal is broader than Nostr: compatible discovery should be possible through multiple transports.

## 23. Current Status

The repository contains a working Nostr-based discovery implementation and a working HTTP Discovery API. The HTTP transport exposes the same canonical service representation through a documented application interface.

The Nostr transport remains the first reference transport, while HTTP provides an independent application-facing discovery interface. The architecture is transport-independent, allowing wallets, providers, directories and applications to use compatible discovery transports without being coupled to the reference implementation.

The repository includes working examples for Nostr discovery, HTTP discovery, independent application clients, independent wallet clients and local end-to-end discovery and settlement flows.

The project is intended to remain open-source and interoperable so that independent wallets, providers, directories and applications can implement discovery without needing permission from the Lipa project.

---

**Open protocol. Multiple transports. No mandatory central registry. Built for Bitcoin services serving African markets.**
