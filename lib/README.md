# lipa-bitcoin-discovery

Open protocol for discovering Bitcoin payment services across Africa. Publish a service listing, discover providers, and publish signed trust signals — all on [Nostr](https://nostr.com), no servers of your own, no API keys, no registration.

Think of it as DNS for payments: it turns `off-ramp, Tanzania, M-Pesa` into a list of providers that can handle it.

- **Publish** — advertise what your service can do (kind `38383`)
- **Discover** — find providers by country, direction, and rail (client-side filtered)
- **Attest** — publish signed attestations and revocations about providers (kinds `38384` / `38385`)

Full protocol details: [`../spec/`](../spec). Architecture and rationale: [`../docs/PROJECT_BLUEPRINT.md`](../docs/PROJECT_BLUEPRINT.md).

**See it work end to end, right now, no setup:**

```bash
node examples/local-e2e-demo.js
```

A self-contained, local simulation (no real relays, no real Lightning node)
showing the full arc: an application discovers a provider it has never heard
of, reads its advertised interaction capability, and completes a simulated
LNURL settlement — all in one run.

---

## 1. Install

```bash
# Inside this repo:
cd lib
npm install
```

> Once the package is published to npm, this becomes `npm install lipa-bitcoin-discovery`.
> The examples below import `lipa-bitcoin-discovery` (the published name). Until it's on npm,
> if you're running code from inside this repo, swap that for `require('./src')`.

Requires Node.js 18 or newer.

---

## 2. Generate your provider identity

Your identity on the network is a Nostr keypair. Generate it once and guard the private key — losing it means losing control of your listing.

```bash
node examples/generate-keys.js
```

Output:

```
Public key (share freely):
  3bf0c63f...          ← this is your permanent provider ID

Private key (KEEP SECRET — store in .env):
  a1b2c3d4...

Add to your .env file:
  NOSTR_PRIVATE_KEY=a1b2c3d4...
```

Put the private key in an environment variable, never in code:

```bash
echo "NOSTR_PRIVATE_KEY=a1b2c3d4..." >> .env
```

---

## 3. Publish a service listing

Advertise your service so any wallet or provider can find you. Only the required fields are mandatory; the rest provide additional information for filtering and consumer-side decisions.

```js
const { Publisher } = require('lipa-bitcoin-discovery');

const publisher = new Publisher({ privateKey: process.env.NOSTR_PRIVATE_KEY });

await publisher.publish({
  // Required
  id:        'provider-a-tz-offramp',         // unique, stable service ID
  name:      'Provider A',
  country:   'TZ',                            // ISO 3166-1 alpha-2
  direction: 'off-ramp',                      // off-ramp | on-ramp | both
  rail_in:   'lightning',                     // lightning | on-chain | ecash
  rail_out:  'm-pesa',                        // m-pesa | mtn-momo | airtel-money | bank | cash
  currency:  'TZS',                           // ISO 4217
  endpoint:  'https://api.example.com',
  health:    'https://api.example.com/health',

  // Optional — recommended
  network:   'vodacom-tz',
  min_amount: '2500',
  max_amount: '1000000',
  fee_range: '1.5-2.2',                       // a range, not exact fees
  speed:     'seconds',                       // seconds | minutes | hours
  protocols: 'bolt11,nwc,lnurl',
  kyc:       'none'                           // none | light | full
});

publisher.close();
```

The listing is signed with your private key and pushed to three public relays (Damus, nostr.band, nos.lol). Republish any time to update — listings are replaceable, so the newest always wins.

---

## 4. Discover providers

Any wallet, app, or provider can query the directory. No key required.

```js
const { Querier } = require('lipa-bitcoin-discovery');

const querier = new Querier();

// Find Lightning → M-Pesa off-ramps in Tanzania
const providers = await querier.find({
  country:   'TZ',
  direction: 'off-ramp',
  rail_out:  'm-pesa'
});

for (const p of providers) {
  console.log(`${p.name}  ${p.fee_range}%  ${p.speed}  ${p.endpoint}`);
}

// Same query, but only return providers whose /health endpoint is live right now:
const healthy = await querier.findHealthy({ country: 'TZ', rail_out: 'm-pesa' });

querier.close();
```

Shortcuts: `findByCountry('KE')`, `findOffRamp('TZ', 'm-pesa')`, `findOnRamp('TZ')`.

---

## 5. Attest — publish trust signals

Attestations and revocations are signed public trust signals. They let providers describe their experience with other providers, while consumers decide how much weight to give those signals. Lipa does not impose a universal trust score or ranking.

```js
const { Attestation } = require('lipa-bitcoin-discovery');

const attestation = new Attestation({ privateKey: process.env.NOSTR_PRIVATE_KEY });

// Vouch for a partner you've worked with
await attestation.vouch(partnerPubkey, {
  rating: 'reliable',
  since:  '2026-01',
  volume: 'medium',
  note:   'Processed cross-border flows reliably.'
});

// Compute a partner's trust score
const result = await attestation.score(partnerPubkey, {
  knownProviders: [/* pubkeys you recognise */],
  anchorPubkey: process.env.ANCHOR_PUBKEY   // optional anchor
});
console.log(result);
// { pubkey, score, attestationCount, revocationCount, breakdown: { ANCHOR, PROVIDER, UNKNOWN, REVOCATION } }

// Withdraw trust (a reason is required)
await attestation.revoke(badPubkey, 'Non-delivery after 3 confirmed complaints');

attestation.close();
```

**Reference scoring weights:** the optional `score()` helper uses trust-anchor attestation `+3`, recognised provider `+1`, unknown key `0`, and active revocation `-10`. These weights are a consumer-side policy, not a universal Lipa trust rating. Unknown keys carry no weight in this reference calculation.

---

## Run the tests

```bash
node test/run.js          # offline logic suite — no network
LIVE=1 node test/run.js   # full cycle against live public relays
```

---

## The three event kinds

| Kind | Name | Meaning |
|------|------|---------|
| `38383` | Service Listing | "Here's what I can do" |
| `38384` | Attestation | "I vouch for this provider" |
| `38385` | Revocation | "I no longer trust this provider" |

All are parameterized replaceable events (NIP-33) — the newest version always wins.

---

## Settlement is yours

This protocol *introduces* parties. How value actually moves between them — quotes, execution, status — is negotiated directly via each provider's own API. Discovery finds. Attestation vouches. Settlement is yours.

MIT licensed. Built for Africa.

## Live Deployment

The HTTP discovery transport is deployed at:

```
https://lipa-bitcoin-discovery.onrender.com
```

- `GET /v1/health` — service status, relay list, cache stats
- `GET /v1/services?country=TZ&direction=off-ramp` — discovery query (see full parameter list above)

Hosted on Render's free tier under the HakiFedha account. The free tier spins down after periods of inactivity; the first request after idle time may take 30-60 seconds while it wakes up.
