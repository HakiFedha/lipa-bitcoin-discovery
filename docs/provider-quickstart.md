# Provider Developer Quickstart: Get Listed on Lipa Bitcoin Discovery

This guide is for Bitcoin payment providers and developers who want to make a service discoverable to wallets and applications through Lipa Bitcoin Discovery.

There is no registration or approval process required by the discovery protocol. You publish your own service description.

Publishing a listing does not mean that HakiFedha has reviewed, verified or endorsed the provider. It means that the provider has published a machine-readable description of its service.

## What You Need

- Node.js 18 or later
- Git
- About five minutes
- Basic information about your service
- A secure place to keep your private key

## Step 1: Get The Tools

    git clone https://github.com/HakiFedha/lipa-bitcoin-discovery.git
    cd lipa-bitcoin-discovery/lib
    npm install

## Step 2: Create Your Provider Identity

Generate a Nostr keypair:

    node examples/generate-keys.js

Your public key identifies the publisher of your discovery listings. Your private key signs what you publish, allowing compatible applications to verify that later listings came from the same key.

The private key is sensitive. Keep it secret and never commit it to a repository or share it with anyone.

For example:

    export NOSTR_PRIVATE_KEY="the_key_it_printed"

For production use, store the private key using an appropriate secret-management method rather than permanently placing it in your shell history or source code.

## Step 3: Choose Your Service Type

Not every service is a simple currency exchange. The service_type field describes what kind of service you actually offer:

| service_type | What it means | Example |
|---|---|---|
| currency-exchange (default) | Exchanging Bitcoin for local currency | Bitcoin to M-Pesa cash-out |
| remittance | Bitcoin sent by one party, fiat delivered to a different recipient | Sending money home to a family member's mobile money account |
| airtime-data | Bitcoin converted directly into phone credit or a data bundle | Bitcoin to Vodacom airtime |
| bill-payment | Bitcoin used to settle a bill or subscription | Bitcoin to pay an electricity bill |
| merchant-payment | Bitcoin accepted directly for goods or services | A shop accepting Lightning at checkout |

If you omit service_type entirely, it defaults to currency-exchange, so this only matters if your service is one of the other four kinds.

## Step 4: Describe Your Service

Open:

    examples/publish-listing.js

and edit the service details to match your actual service.

| Field | What to put |
|---|---|
| `country` | Where you operate, using an ISO country code such as `KE` for Kenya |
| `direction` | `off-ramp` (Bitcoin → local currency), `on-ramp` (local currency → Bitcoin), or `both` |
| `service_type` | See the table in Step 3. Omit for currency-exchange. |
| `rail_in` | How Bitcoin or value reaches the service, such as `lightning`, `on-chain`, or `ecash` |
| `rail_out` | What the customer receives, such as `m-pesa`, `mtn-momo`, `airtel-money`, `bank`, or `cash`. Required for currency-exchange and remittance. Optional otherwise. |
| `product` | Free text naming the specific product or destination for airtime-data, bill-payment, or merchant-payment (e.g. "Vodacom airtime"). Not normally used for currency-exchange. |
| `currency` | Local currency using its ISO code, such as `KES` |
| `endpoint` | An HTTPS URL for the provider's service or integration endpoint, if one is available |
| `health` | An HTTPS URL that can be checked to determine whether the service is reachable and operational |
| `fee_range` | An approximate fee range, such as `"1.5-2.2"` |
| `speed` | Typical processing time, such as `seconds`, `minutes`, or `hours` |

Only publish URLs that you control or are authorised to provide and intend to keep available.

The health endpoint indicates whether a service is reachable or operational. It does not by itself prove that the provider has sufficient liquidity to fulfil a particular transaction.

Live availability or transaction capacity can be added separately. For example, a provider could eventually expose whether a service is currently available, limited, or temporarily unable to process transactions because of insufficient liquidity.

## Step 5: Publish Your Listing

Run:

    node examples/publish-listing.js

The publisher signs your service listing and sends it to the configured Nostr relays.

Once published, compatible wallets and applications can discover the service through supported Lipa Bitcoin Discovery transports.

The same service can also be discovered through the Lipa Discovery HTTP API:

https://lipa-bitcoin-discovery.onrender.com

The HTTP API is a discovery interface for applications that do not need to use Nostr directly.

## Step 6: Confirm That Your Service Is Discoverable

Run:

    node examples/query-providers.js <YOUR_COUNTRY_CODE>

You should see your service listing in the results.

You can also query the HTTP discovery API from a browser or another HTTP client:

https://lipa-bitcoin-discovery.onrender.com/v1/services?country=<YOUR_COUNTRY_CODE>

Discovery means that your listing has been published and can be found by compatible software. It does not mean that HakiFedha has independently verified or endorsed your service.

## Updating Your Listing

If your service changes, publish an updated service description.

For example, you might change:

- Fees
- Supported countries
- Payment rails
- Supported currencies
- Minimum or maximum amounts
- Service status
- Processing speed

Edit `examples/publish-listing.js` and run:

    node examples/publish-listing.js

The newer listing becomes the current version used by compatible discovery clients. Previous Nostr events may remain available as part of the network's history.

## Live Availability And Liquidity

The service listing describes what your service offers. It should not be treated as a permanent statement that the service can fulfil every transaction at every moment.

A provider can optionally expose a live availability or capacity endpoint.

For example, a provider might report:

    {
      "status": "available",
      "max_amount": 500000,
      "currency": "KES"
    }

or temporarily report:

    {
      "status": "liquidity_exhausted",
      "max_amount": 0,
      "currency": "KES"
    }

The provider's own systems should be the source of truth for its current transaction capacity.

This information is separate from the basic discovery listing and can be checked programmatically by compatible applications.

## Getting Vouched For

Providers can optionally publish attestations about other providers.

An attestation can provide an additional trust signal for applications deciding how to evaluate a discovered service.

Attestations do not determine whether a provider is discoverable. They are separate trust signals that applications may choose to consider.

See:

    spec/attestation.md

for the current attestation format.

## Important: Discovery Is Not Verification

Lipa Bitcoin Discovery is designed to make services discoverable.

A published listing does not mean:

- HakiFedha has verified the provider
- HakiFedha guarantees the provider's service
- The provider is currently able to fulfil every transaction
- The provider's liquidity is sufficient for a particular transaction
- A wallet should automatically trust or recommend the provider

Wallets and applications can use their own policies, health checks, attestations, recent activity and other trust signals when deciding which discovered services to show or use.

## Questions And Contributions

For technical questions, report an issue or contribute to the project:

https://github.com/HakiFedha/lipa-bitcoin-discovery/issues

You can also contact:

info@hakifedha.org
