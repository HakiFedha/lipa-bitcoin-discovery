# Independent Wallet Client Demo

This demonstrates a wallet or application discovering Bitcoin payment providers through the Lipa Bitcoin Discovery HTTP Discovery API.

The wallet client deliberately imports nothing from `lib/src/` and knows nothing about Nostr, relays, or event kinds. It only speaks plain HTTPS to the public discovery API:

```
https://lipa-bitcoin-discovery.onrender.com
```

This demonstrates that a wallet can consume Lipa Discovery without being coupled to the reference implementation or its underlying discovery transport.

A wallet developer could build a client like this after reading the HTTP API documentation, without needing to know that the reference discovery implementation uses Nostr.

The underlying Lipa Discovery protocol is transport-independent. Nostr is one discovery transport, while HTTP provides an API that applications and wallets can consume.

## Run It

```
node find-offramp.js ZM mtn-momo
node find-offramp.js TZ m-pesa
node find-offramp.js KE bank
```

For example:

```
node find-offramp.js ZM mtn-momo
```

This asks the discovery API to find Bitcoin off-ramp services in Zambia that support MTN MoMo.

The wallet can then use the discovered service information to present an option to the user.

The wallet does not need to know the provider's name in advance.

## What This Demonstrates

The flow is:

```
Provider
    ↓
Lipa service listing
    ↓
Discovery transport
    ↓
HTTP Discovery API
    ↓
Independent wallet or application
    ↓
User
```

This is an independent Lipa Discovery consumer, not a component that needs to be part of the Lipa reference implementation.
