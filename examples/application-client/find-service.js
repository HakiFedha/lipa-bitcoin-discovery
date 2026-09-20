#!/usr/bin/env node

/**
 * Independent application client demo.
 *
 * Imports NOTHING from lib/src — this file knows only the public HTTP API
 * documented in lib/README.md. It could be written by a developer who has
 * never seen this repository's Nostr implementation.
 *
 * Usage:
 *   node find-service.js ZM currency-exchange mtn-momo
 *   node find-service.js ZM currency-exchange mtn-momo on-ramp
 *   node find-service.js ZM airtime-data off-ramp
 */

const DISCOVERY_API = 'https://lipa-bitcoin-discovery.onrender.com';

const country = process.argv[2];
const serviceType = process.argv[3];
const railOut = process.argv[4];
const direction = process.argv[5] || 'off-ramp';

if (!country || !serviceType) {
  console.error('Usage: node find-service.js <COUNTRY> <SERVICE_TYPE> [rail_out] [direction]');
  console.error('Example: node find-service.js ZM currency-exchange mtn-momo');
  process.exit(1);
}

/**
 * Ask the discovery API for services matching a country, service type and,
 * optionally, an output rail. This is the HTTP integration surface
 * an application can use without knowing the underlying discovery transport.
 */
async function findServices(countryCode, type, rail, serviceDirection) {
  const url = new URL('/v1/services', DISCOVERY_API);
  url.searchParams.set('country', countryCode);
  url.searchParams.set('direction', serviceDirection);
  url.searchParams.set('service_type', type);
  if (rail) url.searchParams.set('rail_out', rail);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Discovery API returned ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  console.log(`Application: looking for ${direction} ${serviceType} services in ${country}${railOut ? ` via ${railOut}` : ''}...\n`);

  const result = await findServices(country, serviceType, railOut, direction);

  if (result.count === 0) {
    console.log('No providers found for this query.');
    return;
  }

  console.log(`Found ${result.count} provider(s):\n`);

  for (const service of result.services) {
    console.log(`  ${service.provider.name}`);
    console.log(`    Service type: ${service.service_type}`);
    if (service.product) console.log(`    Product: ${service.product}`);
    console.log(`    Countries: ${service.countries.join(', ')}`);
    console.log(`    Rails in: ${service.rails.in.join(", ")}`);
    if (service.rails.out?.length) console.log(`    Rails out: ${service.rails.out.join(", ")}`);
    console.log(`    Currencies: ${service.currencies.join(', ')}`);
    console.log(`    Status: ${service.status}`);
    if (service.fee_range) console.log(`    Fee: ${service.fee_range}%`);
    if (service.speed) console.log(`    Speed: ${service.speed}`);
    console.log('');
  }

}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
