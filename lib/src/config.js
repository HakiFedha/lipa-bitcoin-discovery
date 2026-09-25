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
    'bank',
    'cash'
  ],
  status: ['active', 'maintenance', 'offline'],
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

// Default public Nostr relays
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol'
];

// Default TTL: 25 hours in seconds
const DEFAULT_TTL = 90000;

// Max events to pull from a relay per query (bounds memory/CPU; relays also
// cap their own responses). Override per-call where needed.
const DEFAULT_QUERY_LIMIT = 500;

// Health-check hardening: cap the response body we'll read from an untrusted
// provider endpoint, and bound how many endpoints we probe at once.
const MAX_HEALTH_BYTES = 64 * 1024; // 64 KB — a health JSON is tiny
const HEALTH_CONCURRENCY = 8;

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
  DEFAULT_TTL,
  DEFAULT_QUERY_LIMIT,
  MAX_HEALTH_BYTES,
  HEALTH_CONCURRENCY,
  TRUST_WEIGHTS,
  PROTOCOL_VERSION,
  FILTER_TAGS,
  ALT_TEXT,
  VOCAB,
  DEFAULT_SERVICE_TYPE,
  RAIL_OUT_REQUIRED_FOR
};
