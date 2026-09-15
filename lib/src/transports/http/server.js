/**
 * transports/http/server
 *
 * Second reference discovery transport (spec/data-model.md section 4). Wraps
 * the existing Nostr Querier so a wallet or application that doesn't want to
 * touch Nostr can query the same discovery data over plain HTTP.
 *
 * This is a read-through adapter, not a second source of truth: every
 * request queries the configured relays live via the existing Querier.
 */

const express = require('express');
const { Querier } = require('../../querier');
const { normalizeProvider } = require('../../core/normalize');
const { DEFAULT_RELAYS } = require('../../config');

/**
 * Build the Express app for the HTTP discovery transport.
 * @param {Object} [options]
 * @param {string[]} [options.relays] - Relay URLs (defaults to DEFAULT_RELAYS)
 * @returns {import('express').Express}
 */
function createHttpTransport({ relays } = {}) {
  const querier = new Querier({ relays: relays || DEFAULT_RELAYS });
  const app = express();

  // Open discovery: no auth, permissive CORS so browser-based wallets can query directly.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/v1/health', (req, res) => {
    res.json({ status: 'ok', relays: querier.relays });
  });

  app.get('/v1/services', async (req, res) => {
    const { country, direction, rail_in, rail_out, currency, kyc, status, healthy, limit } = req.query;

    const filters = {};
    if (country) filters.country = String(country);
    if (direction) filters.direction = String(direction);
    if (rail_in) filters.rail_in = String(rail_in);
    if (rail_out) filters.rail_out = String(rail_out);
    if (currency) filters.currency = String(currency);
    if (req.query.freshOnly === 'false') filters.freshOnly = false;
    if (limit) {
      const n = Number(limit);
      if (Number.isFinite(n) && n > 0) filters.limit = Math.min(n, 200);
    }

    try {
      let providers = healthy === 'true'
        ? await querier.findHealthy(filters)
        : await querier.find(filters);

      // kyc/status aren't in the Nostr server-side filter set, so apply client-side.
      if (kyc) providers = providers.filter(p => p.kyc === String(kyc));
      if (status) providers = providers.filter(p => p.status === String(status));

      res.json({
        count: providers.length,
        services: providers.map(normalizeProvider)
      });
    } catch (err) {
      res.status(502).json({ error: 'discovery_failed', message: 'Unable to query discovery relays' });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  return app;
}

module.exports = { createHttpTransport };
