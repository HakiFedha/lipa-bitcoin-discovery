# Lipa Bitcoin Discovery

**Open infrastructure for discovering Bitcoin payment services across Africa.**

> **Discovery is open. Trust is configurable. Settlement is separate.**

Lipa Bitcoin Discovery is an open protocol for allowing wallets, payment applications and Bitcoin service providers to discover payment services programmatically.

A provider can describe what it supports, such as Bitcoin to Airtel Money in Zambia, Bitcoin to M-Pesa in Kenya, Bitcoin to MTN Mobile Money in Nigeria or Ghana, or Bitcoin to Orange Money in West Africa.

A wallet or application can then query for services that match what it needs.

The current reference implementation uses Nostr for decentralised discovery. The protocol is designed so that other discovery mechanisms, including HTTP-based services and APIs, can be integrated without changing the underlying service data model.

## The Problem

Bitcoin wallets and payment applications can send and receive Bitcoin, but they do not necessarily know which local services can connect Bitcoin to the payment systems people use every day.

For example, a wallet may need to find:

* an Airtel Money off-ramp in Zambia
* an M-Pesa off-ramp in Kenya
* an MTN Mobile Money service in Nigeria or Ghana
* an Orange Money service in Senegal or Côte d'Ivoire
* a bank-transfer service in another country
* a Bitcoin on-ramp supporting a particular local currency

Today, a wallet developer may need to know about each provider individually and build separate integrations or maintain its own list of providers.

This creates a fragmented ecosystem.

A provider in one country may also need to find another provider in a different country for a cross-border transaction. Without a common discovery mechanism, providers often have to maintain private relationships and manually maintained lists.

Lipa Bitcoin Discovery provides a common way for these services to describe their capabilities and for software to discover them.

## The Solution

Lipa Bitcoin Discovery separates four different problems:

```text
┌──────────────────────────────────────────────────┐
│  1. SERVICE DESCRIPTION                          │
│                                                  │
│  What can this provider do?                     │
│  Country · currency · payment rails · status    │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│  2. DISCOVERY                                    │
│                                                  │
│  How can software find the provider?            │
│  Nostr · HTTP · APIs · other mechanisms         │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│  3. TRUST                                        │
│                                                  │
│  Should the application trust the provider?     │
│  Attestations · verification · other signals    │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│  4. SETTLEMENT                                   │
│                                                  │
│  How do the parties actually transact?          │
│  Determined separately by the parties involved  │
└──────────────────────────────────────────────────┘
```

This separation is important.

Lipa Bitcoin Discovery helps software find a service. It does not become the service, hold funds, or determine how the eventual transaction is settled.

## How It Works

A provider publishes a signed, machine-readable description of its service.

For example:

```json
{
  "name": "Example Zambia",
  "country": "ZM",
  "direction": "off-ramp",
  "rail_in": ["lightning"],
  "rail_out": ["airtel-money"],
  "currency": ["ZMW"],
  "status": "active"
}
```

A wallet or another application can query for services matching its requirements.

A simplified flow looks like this:

```text
Provider
   │
   │ publishes service information
   ▼
Discovery network
   │
   │ query and filter
   ▼
Wallet / Application
   │
   │ selects or presents suitable providers
   ▼
Provider
   │
   │
   ▼
Settlement happens separately
```

The provider does not need to give Lipa control of its existing payment systems.

It does not need to move its customer funds through Lipa.

It simply makes its capabilities discoverable.

## A Wallet Example

Imagine someone in Zambia wants to convert Bitcoin to Airtel Money.

The wallet knows that the user wants:

```text
Country:       Zambia
Direction:     Off-ramp
Payment rail:  Airtel Money
Currency:      ZMW
```

The wallet can query the discovery network and receive matching providers.

It might find:

```text
Provider A
Provider B
Provider C
```

The wallet can then apply its own requirements and trust policies before showing the available options to the user.

The user might simply see:

> **Sell Bitcoin → Airtel Money**

The discovery process happens in the background.

The same mechanism could be used for:

```text
Kenya       → M-Pesa
Nigeria     → MTN Mobile Money
Ghana       → MTN Mobile Money
Zambia      → Airtel Money
Senegal     → Orange Money
Côte d'Ivoire → Orange Money
```

The protocol is not tied to any particular country, mobile-money network or wallet.

## What Does A Wallet Need To Do?

A wallet or application that wants to use Lipa Bitcoin Discovery needs a discovery client or adapter.

Conceptually, it could make a request such as:

```javascript
findServices({
  country: "ZM",
  direction: "off-ramp",
  rail: "airtel-money",
  currency: "ZMW"
});
```

The discovery layer returns matching service listings.

The wallet then decides:

* which providers to show
* which trust signals to accept
* whether to perform a health check
* whether the provider supports the user's amount
* how the provider is presented to the user
* how the actual transaction is initiated

The wallet does not have to use Lipa for settlement.

Lipa's job is to make the appropriate service discoverable.

## What Does A Provider Need To Do?

A provider does not need to rebuild its existing payment infrastructure.

A provider may already have:

```text
Bitcoin
   ↓
Provider backend
   ↓
Mobile-money API
   ↓
Customer receives local currency
```

Lipa Bitcoin Discovery adds a discovery layer alongside that existing infrastructure:

```text
                   Provider
                      │
          ┌───────────┴───────────┐
          │                       │
   Existing systems        Discovery adapter
          │                       │
          │                       ▼
          │                 Service listing
          │                       │
          ▼                       ▼
      Settlement             Discovery
```

The provider's discovery component can publish information such as:

* countries served
* currencies supported
* Bitcoin rails supported
* local payment rails supported
* service direction
* KYC requirements
* operating status
* supported protocols
* minimum and maximum amounts where appropriate

The provider remains responsible for its actual service.

## Provider-To-Provider Discovery

Providers are also potential consumers of the discovery network.

Suppose a provider in Zambia receives a transaction that requires a Kenyan payment service.

Instead of maintaining a private list of Kenyan providers, it can query the discovery network.

```text
Provider A
Zambia
   │
   │ needs Kenyan service
   ▼
Lipa Bitcoin Discovery
   │
   ├── Provider B
   ├── Provider C
   └── Provider D
       Kenya
```

Provider A can then decide whether to work with one of the discovered providers.

This makes it possible for providers to collaborate across countries without every provider having to support every payment rail itself.

Discovery introduces the parties.

The parties decide how they work together.

## Nostr And Other Discovery Mechanisms

The current reference implementation uses **Nostr**.

Nostr is useful because it provides signed events, public keys and a decentralised relay model that can distribute service listings without requiring a central registry.

A simplified Nostr-based implementation looks like:

```text
Provider
   │
   │ signed service listing
   ▼
Nostr relays
   │
   │ query
   ▼
Wallet / Application
```

However, Lipa Bitcoin Discovery should not be understood as requiring every wallet or provider to become a Nostr application.

Nostr is a discovery mechanism used by the current implementation.

The underlying service data model can also be made available through other mechanisms, such as:

```text
Nostr
HTTP API
Discovery gateway
Provider directory API
Other decentralised networks
```

This allows a provider or application that does not use Nostr directly to participate through an appropriate adapter.

The long-term goal is interoperability, not forcing every participant to adopt one particular technology.

## Discovery Is Not Settlement

Lipa Bitcoin Discovery stops at discovery.

It does not define how a discovered provider must settle a transaction with a wallet, user or another provider.

For example:

```text
Discovery
    │
    ▼
"Provider A supports Airtel Money in Zambia."
    │
    ▼
Application selects Provider A
    │
    ▼
Provider-specific transaction flow
    │
    ▼
Settlement
```

The settlement mechanism may depend on the provider and application involved.

Keeping settlement separate makes the discovery layer easier to adopt and prevents the protocol from becoming tied to one payment architecture.

## Trust And Attestations

Being discoverable does not automatically mean that a provider should be trusted.

Lipa Bitcoin Discovery therefore separates discovery from trust.

Providers can publish attestations in which one provider vouches for another.

Applications can use these attestations as one trust signal among others.

An application might consider:

* provider attestations
* its own trusted-provider list
* independent verification
* service status
* health checks
* other reputation or verification signals

Different applications may make different decisions.

There is no requirement for HakiFedha to become a central authority that approves every provider.

> **Discovery is open. Trust is configurable.**

## No Central Registration Requirement

A provider should not have to register with HakiFedha simply to become discoverable.

The protocol is designed so that providers can publish their own signed service information.

This is important for an open ecosystem.

HakiFedha can operate reference infrastructure, publish software, maintain documentation and develop tools around the protocol without becoming a mandatory gatekeeper for participation.

## Lipa Directory And Lipa Bitcoin Discovery

Lipa Bitcoin Discovery is related to, but different from, the HakiFedha Lipa Directory.

> **Lipa Directory helps people find Bitcoin services.**
> **Lipa Bitcoin Discovery helps software find Bitcoin services.**

The [Lipa Directory](https://lipa.hakifedha.org/) is a human-facing directory where information about Bitcoin spending and conversion services can be researched, organised and presented to people.

Lipa Bitcoin Discovery is machine-facing infrastructure.

A wallet does not need to send a person to the Lipa Directory to discover a service.

Instead, the wallet can query the discovery protocol directly.

The two systems can eventually work together, but they serve different purposes.

## Who Is This For?

### Bitcoin Service Providers

Providers can make their services discoverable to wallets, payment applications and other providers.

A provider can publish what it supports without handing control of its business to a central discovery operator.

### Wallets

Wallets can discover relevant providers without hard-coding every provider individually.

This can make it easier to support local payment options across different African markets.

### Payment Applications

Payment applications can discover providers based on country, currency, payment rail and service direction.

### Bitcoin Payment Providers

Providers can use the same discovery infrastructure to find other providers for cross-border or multi-country transactions.

### Other Software

Any application that needs to discover Bitcoin payment services can potentially implement the protocol.

## Current Protocol Model

The current implementation represents a service listing using fields such as:

| Field        | Purpose                                       |
| ------------ | --------------------------------------------- |
| `country`    | Country where the service operates            |
| `direction`  | On-ramp, off-ramp or both                     |
| `rail_in`    | Bitcoin/payment rail accepted by the provider |
| `rail_out`   | Local payment rail provided to the customer   |
| `currency`   | Supported local currency                      |
| `status`     | Current service status                        |
| `kyc`        | KYC requirement                               |
| `speed`      | Approximate service speed                     |
| `min_amount` | Optional minimum amount                       |
| `max_amount` | Optional maximum amount                       |
| `fee_range`  | Optional fee information                      |
| `protocols`  | Supported payment protocols                   |
| `health`     | Optional service health endpoint              |

The vocabulary is designed to be extensible as new countries, currencies and payment rails are added.

## Current Event Model

The current reference implementation uses three Nostr event kinds:

| Kind    | Purpose              |
| ------- | -------------------- |
| `38383` | Service listing      |
| `38384` | Provider attestation |
| `38385` | Trust revocation     |

These are part of the current draft implementation.

They should not yet be treated as final standardised event kinds. The protocol is still being developed and the event model may change as implementation experience and interoperability testing progress.

## What Lipa Bitcoin Discovery Does Not Do

Lipa Bitcoin Discovery does not:

* hold user funds
* process user payments
* act as a payment intermediary
* guarantee that a provider is legitimate
* guarantee provider availability
* decide which providers every application must trust
* require providers to register with HakiFedha
* replace wallets or payment providers
* become a central database that all participants must use
* define a universal settlement system

Its purpose is narrower:

> **Help software discover Bitcoin payment services.**

## Design Principles

### Open

Anyone should be able to publish and query service information without requiring permission from a central authority.

### Interoperable

The common service model should work across different wallets, applications, providers and discovery mechanisms.

### Decentralised

The current reference implementation uses Nostr relays so discovery does not depend on one central registry.

### Trust Without Centralisation

Trust can be established through multiple signals, including provider attestations, without requiring one organisation to approve every participant.

### Privacy-Preserving

Service listings should describe capabilities without unnecessarily exposing sensitive operational or customer information.

### Extensible

The protocol should accommodate new countries, currencies, payment rails and service types as the African Bitcoin ecosystem develops.

### Settlement Separate

Discovery introduces parties to one another.

It does not prescribe how those parties settle transactions.

## Documentation

| Document                                                 | Description                                            |
| -------------------------------------------------------- | ------------------------------------------------------ |
| [Protocol specification](spec/NIP-XXXXX.md)              | Current draft protocol specification                   |
| [Data model](spec/data-model.md)                         | Service listing fields and vocabulary                  |
| [Attestation model](spec/attestation.md)                 | Provider attestations and trust                        |
| [Risks and mitigations](docs/risks-and-mitigations.md)   | Known risks and proposed mitigations                   |
| [Implementation roadmap](docs/implementation-roadmap.md) | Development roadmap                                    |
| [Examples](examples/)                                    | Example events, queries and provider-to-provider flows |

Additional implementation documentation is available in the `lib/` package.

## Current Status

🟡 **Draft**

Lipa Bitcoin Discovery is under active development.

The repository currently contains an experimental reference implementation and draft protocol specifications.

The service data model, event kinds, vocabulary, trust model and discovery interfaces may change as the protocol is tested with providers and applications.

Feedback, implementation experience and review are welcome.

## Origin

The project builds on work initiated at the first Africa Bitcoin Payment Retreat in Naivasha, Kenya, in June 2026.

The original work explored how Bitcoin payment providers across Africa could become discoverable to one another and to applications without relying on a central directory.

Lipa Bitcoin Discovery continues this work as open infrastructure under HakiFedha.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for information about contributing to the project.

## Licence

[MIT](LICENSE)
