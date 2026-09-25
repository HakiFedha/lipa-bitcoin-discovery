# Implementation Roadmap

## Phase 1: Core Specification
- [ ] Finalise the canonical service description
- [ ] Finalise the transport-independent discovery query model
- [ ] Define the transport abstraction and compatibility rules
- [ ] Define freshness, liveness, trust, versioning, and security principles
- [ ] Document Nostr as the first reference transport
- [x] Define the HTTP/API discovery transport
- [ ] Circulate the specification for community feedback
- [ ] Finalise the Nostr tag vocabulary and transport rules
- [ ] Prepare a Nostr community specification or NIP if appropriate

## Phase 2: Reference Implementation
- [ ] Build the common discovery interface and reference library
- [x] Build the Nostr discovery adapter
- [x] Build the Nostr publisher and querier
- [x] Build the HTTP/API discovery adapter
- [x] Implement a provider-hosted HTTP/API discovery endpoint
- [ ] Add interoperability tests across discovery transports
- [x] Publish example service descriptions and discovery queries
- [ ] Early contributors publish test service descriptions through the reference transports
- [x] Test publish → discover → filter → verify round-trip flows

## Phase 3: Integration
- [ ] Each provider integrates a discovery publisher or provider-hosted discovery endpoint
- [ ] Each provider deploys a `/health` endpoint where appropriate
- [ ] First wallet partner integrates discovery
- [ ] Demonstrate discovery through both Nostr and HTTP/API
- [ ] Demonstrate provider-to-provider discovery across a cross-border corridor
- [x] Add optional attestations and other trust signals
- [ ] Record and share a proof-of-concept demonstration


## Phase 4: Production
- [ ] Open discovery to additional providers
- [ ] Support additional wallet and application integrations
- [ ] Build a public explorer as a consumer of the discovery protocol
- [ ] Add additional discovery transports where there is a clear need
- [ ] Test interoperability with independent implementations
- [ ] Monitor real-world usage, abuse, freshness, and provider availability
- [ ] Iterate on the specification based on real-world experience

## Who Builds What

| Component | Owner | Notes |
|-----------|-------|-------|
| Core specification | Community (collaborative) | Canonical service description, queries, compatibility, security, and versioning |
| Nostr transport | Contributors | Open source reference transport |
| HTTP/API transport | Contributors | Open source reference transport |
| Common discovery library | Contributors | Shared interface used by transport adapters |
| Provider discovery endpoint | Each provider | May use HTTP/API or another supported transport |
| Service description publisher | Each provider | Publishes or exposes the provider service description |
| `/health` endpoint | Each provider | Optional liveness mechanism where appropriate |
| Trust signals | Providers, applications, and other participants | Application-specific evaluation; no mandatory universal trust score |
| Wallet integration | Wallet teams | Uses the common discovery interface or a supported transport |
| Provider-to-provider integration | Providers and application developers | Supports cross-border routing and service discovery |
| Public explorer | Any contributor or volunteer | A consumer of the discovery protocol, not the protocol itself |
