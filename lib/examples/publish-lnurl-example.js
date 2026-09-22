const { Publisher, loadKeysFromEnv } = require('../src/index');

// SIMULATION ONLY
// This example publishes a single listing that advertises LNURL settlement
// profile conformance (spec/settlement-lnurl.md, off-ramp only). The lnaddr
// value uses a placeholder, non-resolvable domain ("example.com") since no
// real LNURL server exists yet. This tests only the discovery-layer data
// shape (protocols + lnaddr fields), not an actual LNURL/settlement flow.

let keys;

if (!process.env.LNURL_EXAMPLE_GH_KEY) {
  console.error('ERROR: LNURL_EXAMPLE_GH_KEY is not set.');
  console.error('Refusing to generate a new identity.');
  console.error('Set a persistent test key before running this example.');
  process.exit(1);
}

try {
  keys = loadKeysFromEnv('LNURL_EXAMPLE_GH_KEY');
} catch (error) {
  console.error('ERROR: LNURL_EXAMPLE_GH_KEY is invalid.');
  console.error('Refusing to generate a new identity.');
  process.exit(1);
}

const publisher = new Publisher({
  privateKey: keys.privateKey,
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol'
  ]
});

const listing = {
  id: 'example-gh-lnurl-off-ramp',
  name: 'Example Ghana LNURL Off-Ramp',
  country: 'GH',
  direction: 'off-ramp',
  service_type: 'currency-exchange',
  rails: {
    in: ['lightning'],
    out: ['mtn-momo']
  },
  currency: 'GHS',
  status: 'active',
  kyc: 'none',
  speed: 'seconds',
  protocols: ['bolt11', 'lnurl'],
  lnaddr: '{phone}@example.com',
  metadata: {
    description: 'Simulated LNURL-conformant off-ramp for protocol testing.',
    note: 'Placeholder lnaddr domain — not a real, resolvable LNURL server.'
  }
};

async function publishLnurlExample() {
  console.log('=== LNURL Listing Example ===');
  console.log('SIMULATION ONLY — tests discovery-layer data shape only.');
  console.log('lnaddr uses a placeholder domain and is not resolvable.');
  console.log('Public Key:', keys.publicKey);
  console.log('--------------------------------------------\n');

  console.log('Publishing:', listing.id);
  console.log('  protocols:', listing.protocols.join(', '));
  console.log('  lnaddr:', listing.lnaddr);

  const result = await publisher.publish(listing);
  console.log('  Event ID:', result.eventId);

  console.log('\nDone.');
  publisher.close();
}

publishLnurlExample().catch((error) => {
  console.error('Failed:', error.message);
  publisher.close();
  process.exit(1);
});
