const { Publisher, loadKeysFromEnv } = require('../src/index');

// SIMULATION ONLY
// This example does not represent an authorised Bit2Kwacha integration.
// It publishes simulated service descriptions for testing the Lipa Bitcoin
// Discovery protocol.
//
// IMPORTANT: this identity is persistent, not regenerated per run. A fresh
// identity on every run would leave orphaned duplicate listings on public
// relays with no way to update or revoke them later, since nobody would
// hold that run's private key. Set BIT2KWACHA_PILOT_KEY once and reuse it:
//
//   export BIT2KWACHA_PILOT_KEY="<hex private key>"
//
// The variable must be set to a persistent private key. This script refuses
// to generate a new identity, so every run uses the same pilot identity.

let keys;

if (!process.env.BIT2KWACHA_PILOT_KEY) {
  console.error('ERROR: BIT2KWACHA_PILOT_KEY is not set.');
  console.error('Refusing to generate a new identity.');
  console.error('Set a persistent pilot key before running this script.');
  process.exit(1);
}

try {
  keys = loadKeysFromEnv('BIT2KWACHA_PILOT_KEY');
} catch (error) {
  console.error('ERROR: BIT2KWACHA_PILOT_KEY is invalid.');
  console.error('Refusing to generate a new identity.');
  process.exit(1);
}

console.log('=== Simulated Bit2Kwacha Discovery Pilot ===');
console.log('This is NOT an authorised Bit2Kwacha integration.');
console.log('Reusing saved pilot identity. Public Key:', keys.publicKey);
console.log('--------------------------------------------\n');

const publisher = new Publisher({
  privateKey: keys.privateKey,
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol'
  ]
});

// Simulated Bitcoin purchase service:
// mobile money → Lightning
const buyBitcoinListing = {
  id: 'simulated-bit2kwacha-zm-buy',
  name: 'Simulated Bit2Kwacha',
  country: 'ZM',
  direction: 'on-ramp',
  service_type: 'currency-exchange',
  rails: {
    in: ['mtn-momo', 'airtel-money', 'zamtel-money'],
    out: ['lightning']
  },
  currency: 'ZMW',
  status: 'active',
  kyc: 'none',
  speed: 'seconds',
  min_amount: '20',
  protocols: ['bolt11'],
  metadata: {
    description: 'Simulated Bitcoin purchase using Zambian mobile money.',
    website: 'https://bit2kwacha.info',
    languages: ['en']
  }
};

// Simulated Bitcoin sale service:
// Lightning → mobile money
const sellBitcoinListing = {
  id: 'simulated-bit2kwacha-zm-sell',
  name: 'Simulated Bit2Kwacha',
  country: 'ZM',
  direction: 'off-ramp',
  service_type: 'currency-exchange',
  rails: {
    in: ['lightning'],
    out: ['mtn-momo', 'airtel-money', 'zamtel-money']
  },
  currency: 'ZMW',
  status: 'active',
  kyc: 'none',
  speed: 'seconds',
  min_amount: '500',
  protocols: ['bolt11'],
  metadata: {
    description: 'Simulated Bitcoin sale to Zambian mobile money.',
    website: 'https://bit2kwacha.info',
    languages: ['en']
  }
};

// Simulated airtime service:
// Lightning → airtime
const airtimeListing = {
  id: 'simulated-bit2kwacha-zm-airtime',
  name: 'Simulated Bit2Kwacha Airtime & Data',
  country: 'ZM',
  direction: 'off-ramp',
  service_type: 'airtime-data',
  product: 'airtime',
  rails: {
    in: ['lightning'],
    out: []
  },
  currency: 'ZMW',
  status: 'active',
  kyc: 'none',
  speed: 'seconds',
  min_amount: '5',
  max_amount: '1000',
  protocols: ['bolt11'],
  metadata: {
    description: 'Simulated purchase of Zambian airtime with Bitcoin Lightning.',
    website: 'https://bit2kwacha.info',
    languages: ['en']
  }
};

async function publishPilot() {
  console.log('Publishing simulated Bitcoin purchase listing...');
  const event1 = await publisher.publish(buyBitcoinListing);
  console.log('Published Event ID:', event1.eventId);

  console.log('\nPublishing simulated Bitcoin sale listing...');
  const event2 = await publisher.publish(sellBitcoinListing);
  console.log('Published Event ID:', event2.eventId);

  console.log('\nPublishing simulated airtime listing...');
  const event3 = await publisher.publish(airtimeListing);
  console.log('Published Event ID:', event3.eventId);

  console.log('\nSimulation complete.');
  publisher.close();
}

publishPilot().catch((error) => {
  console.error('Pilot failed:', error.message);
  publisher.close();
  process.exit(1);
});
