# Independent Application Client Demo

This example shows how an application can discover Bitcoin services through the Lipa Bitcoin Discovery HTTP API without importing or depending on the repository's internal discovery implementation.

The client only needs the public HTTP API. A developer could build a similar integration without knowing whether the underlying discovery transport is Nostr, HTTP, or another transport.

## Usage

```bash
node find-service.js ZM currency-exchange m-pesa
node find-service.js ZM currency-exchange mtn-momo on-ramp
node find-service.js ZM airtime-data off-ramp
```

Arguments:

- `COUNTRY` — ISO country code, such as `ZM` or `TZ`.
- `SERVICE_TYPE` — service type such as `currency-exchange`, `remittance`, or `airtime-data`.
- `rail_out` — optional output rail such as `m-pesa`.
- `direction` — optional value-flow direction: `on-ramp`, `off-ramp`, or `both`. Defaults to `off-ramp`.

The example queries the HTTP discovery endpoint and displays the services that match the request.

This is a generic application example. A wallet, remittance application, directory, merchant application, or another service can use the same discovery interface.
