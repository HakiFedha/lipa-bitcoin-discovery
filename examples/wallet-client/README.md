# Independent Wallet Client Demo

This demonstrates a wallet or application discovering Bitcoin payment
providers through the Lipa Bitcoin Discovery **HTTP transport only**.

It deliberately imports nothing from `lib/src/` and knows nothing about
Nostr, relays, or event kinds. It only speaks plain HTTPS to:

    https://lipa-bitcoin-discovery.onrender.com

This is the proof that the HTTP transport genuinely decouples consumers
from the underlying discovery mechanism (spec/data-model.md section 4) —
a real wallet developer could write this exact file having read only the
HTTP API's query parameters, with no knowledge of the protocol's Nostr
reference implementation.

## Run it

    node find-offramp.js TZ m-pesa
    node find-offramp.js KE bank
