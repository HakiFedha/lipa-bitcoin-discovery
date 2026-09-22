const { Publisher, loadKeysFromEnv } = require('../src/index');

// SIMULATION ONLY
// This example publishes two independent simulated providers to test
// cross-border discovery. It does not represent real providers or
// real settlement relationships.

function loadProviderKey(envVar, label) {
  try {
    return loadKeysFromEnv(envVar);
  } catch (error) {
    console.error(`ERROR: ${envVar} is not set or is invalid.`);
    console.error(`Set the ${label} test key before running this example.`);
    process.exit(1);
  }
}

const zmKeys = loadProviderKey('CROSS_BORDER_ZM_KEY', 'Zambia');
const keKeys = loadProviderKey('CROSS_BORDER_KE_KEY', 'Kenya');

const relays = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol'
];

const zmPublisher = new Publisher({
  privateKey: zmKeys.privateKey,
  relays
});

const kePublisher = new Publisher({
  privateKey: keKeys.privateKey,
  relays
});

const services = [
  {
    publisher: zmPublisher,
    label: 'Zambia',
    listing: {
      id: 'cross-border-zm-off-ramp',
      name: 'Example Zambia Off-Ramp',
      country: 'ZM',
      direction: 'off-ramp',
      service_type: 'currency-exchange',
      rails: {
        in: ['lightning'],
        out: ['mtn-momo', 'airtel-money']
      },
      currency: 'ZMW',
      status: 'active',
      kyc: 'none',
      speed: 'seconds'
    }
  },
  {
    publisher: kePublisher,
    label: 'Kenya',
    listing: {
      id: 'cross-border-ke-off-ramp',
      name: 'Example Kenya Off-Ramp',
      country: 'KE',
      direction: 'off-ramp',
      service_type: 'currency-exchange',
      rails: {
        in: ['lightning'],
        out: ['m-pesa']
      },
      currency: 'KES',
      status: 'active',
      kyc: 'none',
      speed: 'seconds'
    }
  }
];

async function publishServices() {
  console.log('=== Cross-Border Discovery Test ===');
  console.log('SIMULATION ONLY - these are independent test providers.');
  console.log('They do not represent real providers or settlement relationships.');
  console.log('');

  for (const service of services) {
    console.log(`Publishing ${service.label} service...`);
    console.log('  Provider public key:', service.publisher.publicKey);
    console.log('  Service:', service.listing.id);
    console.log('  Country:', service.listing.country);
    console.log('  Rails:', service.listing.rails.in.join(', '), '→', service.listing.rails.out.join(', '));

    const result = await service.publisher.publish(service.listing);

    console.log('  Event ID:', result.eventId);
    console.log('');
  }

  console.log('Published', services.length, 'cross-border test services.');

  zmPublisher.close();
  kePublisher.close();
}

publishServices().catch((error) => {
  console.error('Cross-border test failed:', error.message);
  zmPublisher.close();
  kePublisher.close();
  process.exit(1);
});
