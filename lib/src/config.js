const WebSocket = require('ws');

// Polyfill WebSocket for Node.js
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

// Protocol version (carried in the `v` tag on every event)
const PROTOCOL_VERSION = '0.3';

// The six filterable fields map to single-letter tags so relays can index them
// for server-side filtering. Single source of truth — publisher emits these,
// querier reads/filters by them. Everything else stays a multi-letter display tag.
const FILTER_TAGS = {
  country: 'c',
  direction: 'o',
  service_type: 's',
  rail_in: 'i',
  rail_out: 'm',
  currency: 'f'
};

// Default service_type when a listing omits it — preserves the meaning of
// every listing published before this field existed.
const DEFAULT_SERVICE_TYPE = 'currency-exchange';

// Controlled vocabularies (used for publisher validation and type definitions)
const VOCAB = {
  direction: ['off-ramp', 'on-ramp', 'both'],
  service_type: ['currency-exchange', 'remittance', 'airtime-data', 'bill-payment', 'merchant-payment'],
  rail: [
    'lightning',
    'on-chain',
    'ecash',
    'lnurl',
    'm-pesa',
    'mtn-momo',
    'airtel-money',
    'orange-money',
    'zamtel-money',
    'lumicash',
    'ihela',
    'bank',
    'cash'
  ],
  status: ['active', 'inactive', 'paused'],
  status_reason: ['out_of_float', 'maintenance', 'regulatory', 'other'],
  kyc: ['none', 'light', 'full'],
  speed: ['seconds', 'minutes', 'hours']
};

// service_type values where an outbound rail is required.
// The others may settle the obligation directly with no fiat rail at all.
const RAIL_OUT_REQUIRED_FOR = ['currency-exchange', 'remittance'];

// Human-readable NIP-31 alt text per kind
const ALT_TEXT = {
  38383: 'Lipa Bitcoin service listing',
  38384: 'Lipa Bitcoin provider attestation (vouch)',
  38385: 'Lipa Bitcoin provider trust revocation'
};

// Protocol event kinds
const KINDS = {
  SERVICE_LISTING: 38383,
  ATTESTATION: 38384,
  REVOCATION: 38385
};

// Pubkeys whose events are excluded from query results regardless of ttl or
// content. Used for keys that are known-compromised or unrecoverable, where a
// revocation event can't be signed. Add a short reason with each entry.
const DENIED_PUBKEYS = [
  // Simulated/test listings published under a key with no saved private key
  // (see docs/risks-and-mitigations.md or project notes). Example services
  // for ZM: buy, remittance, airtime, bill-payment, merchant-payment.
  'd118b870be9398180ea62e672a022ce4489d392bc00872d5608c6aa85b2ef7f3',
  // A second, separate batch of simulated ZM example listings, also
  // published under a key with no saved private key.
  'b8721826ad46bfa9007dec75e7d44e43aca529fe969290790bd94613a18e8e61'
];

// Default public Nostr relays
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://offchain.pub'
];

// Default TTL: 30 days in seconds. A listing stays visible for this long after
// it was last published, unless it carries its own ttl tag.
const DEFAULT_TTL = 2592000;

// Earlier releases wrote this value (25 hours) into every listing by default.
// It is read as "no explicit choice", so those listings get the current default.
const LEGACY_DEFAULT_TTL = 90000;

// How far back a query looks on the relays (one year). Each listing's own
// lifetime is then applied by the querier.
const MAX_LOOKBACK_SECONDS = 31536000;

// Max events to pull from a relay per query (bounds memory/CPU; relays also
// cap their own responses). Override per-call where needed.
const DEFAULT_QUERY_LIMIT = 500;

// Health-check hardening: cap the response body we'll read from an untrusted
// provider endpoint, and bound how many endpoints we probe at once.
const MAX_HEALTH_BYTES = 64 * 1024; // 64 KB — a health JSON is tiny
const HEALTH_CONCURRENCY = 8;

// Health-endpoint status strings we treat as "healthy". Providers write their
// own health checks independently and reasonably vary in wording; we're
// liberal here even though the canonical service listing's own `status`
// field (see VOCAB.status) is validated strictly.
const HEALTHY_STATUS_VALUES = ['active', 'ok', 'healthy', 'up'];

// Trust scoring weights
const TRUST_WEIGHTS = {
  ANCHOR: 3,
  PROVIDER: 1,
  UNKNOWN: 0,
  REVOCATION: -10
};

module.exports = {
  KINDS,
  DEFAULT_RELAYS,
  DENIED_PUBKEYS,
  DEFAULT_TTL,
  LEGACY_DEFAULT_TTL,
  MAX_LOOKBACK_SECONDS,
  DEFAULT_QUERY_LIMIT,
  MAX_HEALTH_BYTES,
  HEALTH_CONCURRENCY,
  HEALTHY_STATUS_VALUES,
  TRUST_WEIGHTS,
  PROTOCOL_VERSION,
  FILTER_TAGS,
  ALT_TEXT,
  VOCAB,
  DEFAULT_SERVICE_TYPE,
  RAIL_OUT_REQUIRED_FOR
};
