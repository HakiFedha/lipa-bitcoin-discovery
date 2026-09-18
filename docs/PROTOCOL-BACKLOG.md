# Protocol Backlog

This file records protocol questions and design issues that should be resolved deliberately before the relevant integration stage. It is not part of the canonical protocol specification.

## Listing Lifecycle

The current protocol has provider-level trust revocation through Nostr kind 38385, but no listing-level withdrawal or replacement mechanism.

A provider may publish multiple service listings under one provider identity, so a mechanism is needed to retire or replace one specific service listing without revoking the provider as a whole.

Do not improvise a listing-level revocation mechanism solely to remove test or diagnostic events. Design this deliberately before production lifecycle management.

## Direction Semantics

`direction: off-ramp` is currently applied to both value-exchanging services, such as Bitcoin → mobile money, and value-consuming services, such as Bitcoin → airtime, bill payments, or merchant payments.

These are semantically different for a consumer application distinguishing "get local currency" from "spend Bitcoin directly". A wallet querying `direction: off-ramp` could otherwise receive both kinds of service and reasonably interpret them as currency-conversion services.

Revisit this before the wallet-integration stage. Possible approaches include refining direction semantics, introducing a separate service-purpose or settlement classification, or otherwise making the distinction explicit without breaking the canonical service model.
