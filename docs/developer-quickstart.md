# Developer Quickstart: Find Bitcoin Services With Lipa Bitcoin Discovery

This guide is for developers whose software needs to find Bitcoin on-ramp and off-ramp services across Africa: wallets, apps, and providers that route payments to other providers.

Discovery usually happens in the background. A wallet can look up a remittance route, or a provider can find a payout partner in another country, without the end user ever knowing Lipa is involved.

Providers publish their own listings with their own keys. You do not need an account, an API key or anyone's approval to read them.

If you are a provider who wants to be listed, see `docs/provider-quickstart.md` instead.

## What You Need

- Any HTTP client. `curl` is enough to follow this guide.
- Node.js 18 or later, only if you want to run the example wallet client.

## Step 1: Try The Live API

Ask for the services available in Zambia:

    curl -s "https://lipa-bitcoin-discovery.onrender.com/v1/services?country=ZM"

You will get a JSON object with a `count` and a list of `services`.

The public instance runs on a free hosting tier. If nobody has used it for a while, the first request can take up to a minute while it wakes up. Later requests are fast.

## Step 2: Filter The Results

Add any of these as query parameters:

| Parameter | What it does |
|---|---|
| `country` | ISO country code, such as `KE` or `ZM` |
| `direction` | `on-ramp`, `off-ramp` or `both`. Services marked `both` are included in directional queries. |
| `service_type` | `currency-exchange`, `remittance`, `airtime-data`, `bill-payment` or `merchant-payment` |
| `rail_in` | Rail the customer pays with, such as `lightning` or `mtn-momo` |
| `rail_out` | Rail the customer receives through, such as `mtn-momo` or `lightning` |
| `currency` | ISO currency code, such as `ZMW` |
| `kyc` | `none`, `light` or `full` |
| `status` | `active`, `inactive` or `paused` |
| `healthy` | `true` keeps only services that publish a `health` URL and respond to it. Services with no health URL are left out, and many real providers do not publish one, so this filter can hide good services. Use it with care. |
| `limit` | Maximum number of results, capped at 200 |
| `freshOnly` | By default, listings past their `ttl` are left out. Pass `false` to include them. |

Example: services where a customer can sell Bitcoin for MTN Mobile Money in Zambia:

    curl -s "https://lipa-bitcoin-discovery.onrender.com/v1/services?country=ZM&direction=off-ramp&rail_out=mtn-momo"

Rail names are matched exactly as providers publish them, so use `mtn-momo`, not `MTN`. The list of known rails is in `spec/data-model.md`, and new rails can appear as providers join.

## Step 3: Read The Response

Each service looks like this (trimmed):

    {
      "id": "d5261357...:bitzed-zm-exchange",
      "provider": { "name": "BitZed", "pubkey": "d5261357..." },
      "countries": ["ZM"],
      "direction": "both",
      "service_type": "currency-exchange",
      "rails": { "in": ["lightning"], "out": ["mtn-momo", "airtel-money", "zamtel-money"] },
      "currencies": ["ZMW"],
      "status": "active",
      "min_amount": "1",
      "max_amount": "1000",
      "fee_range": "0-3",
      "kyc": "none",
      "endpoint": null,
      "health": null,
      "metadata": { "website": "https://bitzed.xyz" }
    }

Missing values matter, so read them carefully:

- **`fee_range` is null:** The provider has not published fees. Treat fees as unknown, not as free.
- **`endpoint` and `health` are null:** The provider has no API for you to call. Many real services are human-assisted, Lightning-only or website-only. They are still valid listings. Send your user to `metadata.website`.
- **`min_amount` and `max_amount` are null:** No limit was published. Amounts are strings, in the local currency.
- **`status` is `paused`:** The service is temporarily unavailable. `status_reason` may say why: `out_of_float`, `maintenance`, `regulatory` or `other`.
- **`ttl`:** How long the listing counts as fresh. The default is 30 days.

The full field reference is in `spec/data-model.md`.

## Step 4: Choose A Transport

The same listings can be read three ways. Pick the one that suits your app:

| Transport | Best for | Trade-off |
|---|---|---|
| HTTP API (this guide) | The fastest start. No Nostr knowledge needed. | Depends on the HakiFedha-run server being up. |
| Nostr relays, event kind `38383` | No dependency on HakiFedha. This is the protocol's actual foundation. | You query relays and filter results yourself. |
| Provider-hosted, `GET /.well-known/lipa` | A wallet that already knows a specific provider. | You must know the provider's domain. |

Copy-ready snippets for all three are on the live try page: https://lipa.hakifedha.org/try

A complete small example is in `examples/wallet-client/`.

## Step 5: Handle Failures Gracefully

- **First request is slow:** See Step 1. Allow a generous timeout, or retry once.
- **`502` with `discovery_failed`:** The server could not reach the relays. Wait a moment and try again. Failures are not cached.
- **`429`:** You sent too many requests. By default the limit is 30 per minute per client address. Wait for the number of seconds in the `Retry-After` header.
- **Caching:** Responses are cached for 30 seconds. The `X-Cache` header says `HIT` or `MISS`. Add `noCache=true` while testing.
- **Empty results:** An empty list can be a true answer, for example when nobody serves that country yet. Do not treat it as an error.

Browser apps can call the API directly, because cross-origin requests are allowed.

## Step 6: Decide Which Services Your Software Can Use

Discovery is not verification. A listing means a provider has published a description of its service. It does not mean HakiFedha has reviewed, verified or endorsed it, or that it can fulfil any particular transaction right now.

Sensible defaults for software that picks a service automatically:

- Use only `status=active` services.
- Treat fees as unknown when `fee_range` is missing, not as free.
- Check that the amount is inside `min_amount` and `max_amount` when they are published.
- Check the service's `health` URL when one is published, and keep a fallback ready, because a healthy response does not guarantee a transaction will succeed.
- Consider attestations from other providers as an extra trust signal. See `spec/attestation.md`.
- Apply your own policy, such as preferred rails or recent activity. Different applications may reasonably choose differently.

If your software does show services to people, link to the provider's own website so they can check it themselves.

## Going Further

- `spec/data-model.md`: the full data model and Nostr tags
- `examples/wallet-client/`: a small working wallet example
- `examples/wallet-query-flow.json`: an example query flow
- `docs/provider-quickstart.md`: the provider side of the same protocol

## Questions And Contributions

Report an issue or contribute at https://github.com/HakiFedha/lipa-bitcoin-discovery/issues

You can also contact: info@hakifedha.org
