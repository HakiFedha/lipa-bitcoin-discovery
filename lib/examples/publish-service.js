const { Publisher, loadKeysFromEnv } = require('../src/index');

// SIMULATION ONLY
// This example publishes generic service descriptions for testing the
// Lipa Bitcoin Discovery protocol. It does not represent real providers.
//
// IMPORTANT: this identity is persistent. Set PUBLISH_SERVICE_TEST_KEY once
// and reuse it for repeatable testing. The script refuses to generate a new
// identity so repeated runs do not create orphaned test identities.

let keys;

if (!process.env.PUBLISH_SERVICE_TEST_KEY) {
  console.error('ERROR: PUBLISH_SERVICE_TEST_KEY is not set.');
  console.error('Refusing to generate a new identity.');
  console.error('Set a persistent test key before running this script.');
  process.exit(1);
}

try {
  keys = loadKeysFromEnv('PUBLISH_SERVICE_TEST_KEY');
} catch (error) {
  console.error('ERROR: PUBLISH_SERVICE_TEST_KEY is invalid.');
  console.error('Refusing to generate a new identity.');
  process.exit(1);
}

const services = [
  {
    id: 'example-zm-buy',
    name: 'Example Bitcoin Exchange',
    country: 'ZM',
    direction: 'on-ramp',
    service_type: 'currency-exchange',
    rails: {
      in: ['mtn-momo', 'airtel-money'],
      out: ['lightning']
    },
    currency: 'ZMW',
    status: 'active',
    kyc: 'none',
    speed: 'seconds',
    min_amount: '20'
  },
  {
    id: 'example-zm-remittance',
    name: 'Example Bitcoin Remittance',
    country: 'ZM',
    direction: 'off-ramp',
    service_type: 'remittance',
    rails: {
      in: ['lightning'],
      out: ['mtn-momo', 'airtel-money']
    },
    currency: 'ZMW',
    status: 'active',
    kyc: 'light',
    speed: 'minutes'
  },
  {
    id: 'example-zm-airtime',
    name: 'Example Airtime & Data',
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
    speed: 'seconds'
  },
  {
    id: 'example-zm-bill-payment',
    name: 'Example Bill Payment',
    country: 'ZM',
    direction: 'off-ramp',
    service_type: 'bill-payment',
    product: 'electricity',
    rails: {
      in: ['lightning'],
      out: []
    },
    currency: 'ZMW',
    status: 'active',
    kyc: 'none',
    speed: 'seconds'
  },
  {
    id: 'example-zm-merchant-payment',
    name: 'Example Merchant Payments',
    country: 'ZM',
    direction: 'off-ramp',
    service_type: 'merchant-payment',
    product: 'retail',
    rails: {
      in: ['lightning'],
      out: []
    },
    currency: 'ZMW',
    status: 'active',
    kyc: 'none',
    speed: 'seconds'
  }
];

const publisher = new Publisher({
  privateKey: keys.privateKey,
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol'
  ]
});

async function publishServices() {
  console.log('=== Generic Lipa Bitcoin Discovery Service Example ===');
  console.log('SIMULATION ONLY - these are generic test services.');
  console.log('Reusing saved test identity. Public Key:', keys.publicKey);
  console.log('--------------------------------------------\n');

  for (const service of services) {
    console.log('Publishing:', service.id);
    console.log('  Service type:', service.service_type);
    console.log('  Rails:', service.rails.in.join(', '), '→', service.rails.out.join(', '));

    const result = await publisher.publish(service);
    console.log('  Event ID:', result.eventId);
    console.log('');
  }

  console.log('Published', services.length, 'generic service descriptions.');
  publisher.close();
}

publishServices().catch((error) => {
  console.error('Example failed:', error.message);
  publisher.close();
  process.exit(1);
});
