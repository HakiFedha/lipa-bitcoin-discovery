#!/usr/bin/env node

/**
 * Independent wallet client demo.
 *
 * Imports NOTHING from lib/src — this file knows only the public HTTP API
 * documented in lib/README.md. It could be written by a developer who has
 * never seen this repository's Nostr implementation.
 *
 * Usage:
 *   node find-offramp.js TZ m-pesa
 *   node find-offramp.js KE bank
 */

const DISCOVERY_API = 'https://lipa-bitcoin-discovery.onrender.com';

const country = process.argv[2];
const railOut = process.argv[3];

if (!country) {
  console.error('Usage: node find-offramp.js <COUNTRY> [rail_out]');
  console.error('Example: node find-offramp.js TZ m-pesa');
  process.exit(1);
}

/**
 * Ask the discovery API for off-ramp providers matching a country and,
 * optionally, a local payment rail. This is the only integration surface
 * a wallet needs — a single GET request against documented query params.
 */
async function findOffRampProviders(countryCode, rail) {
  const url = new URL('/v1/services', DISCOVERY_API);
  url.searchParams.set('country', countryCode);
  url.searchParams.set('direction', 'off-ramp');
  if (rail) url.searchParams.set('rail_out', rail);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Discovery API returned ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  console.log(`Wallet: looking for off-ramp providers in ${country}${railOut ? ` via ${railOut}` : ''}...\n`);

  const result = await findOffRampProviders(country, railOut);

  if (result.count === 0) {
    console.log('No providers found for this query.');
    return;
  }

  console.log(`Found ${result.count} provider(s):\n`);

  for (const service of result.services) {
    console.log(`  ${service.provider.name}`);
    console.log(`    Countries: ${service.countries.join(', ')}`);
    console.log(`    Rails: ${service.rails.in.join(', ')} -> ${service.rails.out.join(', ')}`);
    console.log(`    Currencies: ${service.currencies.join(', ')}`);
    console.log(`    Status: ${service.status}`);
    if (service.fee_range) console.log(`    Fee: ${service.fee_range}%`);
    if (service.speed) console.log(`    Speed: ${service.speed}`);
    console.log('');
  }

  const top = result.services[0];
  console.log(`Wallet UI would now show: "Send to ${top.provider.name}" as an option.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
