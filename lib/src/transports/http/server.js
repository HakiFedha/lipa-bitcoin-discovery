/**
 * transports/http/server
 *
 * Second reference discovery transport (spec/data-model.md section 4). Wraps
 * the existing Nostr Querier so a wallet or application that doesn't want to
 * touch Nostr can query the same discovery data over plain HTTP.
 *
 * This is a read-through cache over the relay data, not a second source of
 * truth: every cache miss queries the configured relays live via the
 * existing Querier. The cache exists only to protect the relays from being
 * hit on every single incoming request.
 */

const express = require('express');
const { Querier } = require('../../querier');
const { normalizeProvider } = require('../../core/normalize');
const { DEFAULT_RELAYS } = require('../../config');
const { createRateLimiter } = require('./rateLimit');

const DEFAULT_CACHE_TTL_MS = 30000; // 30s: short enough to stay fresh, long enough to absorb bursts

/**
 * Build a stable cache key from the resolved query filters. Order-independent
 * by construction (object key order below is fixed), so two requests with the
 * same effective filters always hash to the same key regardless of query
 * string order.
 * @param {Object} filters - The resolved filters object passed to the Querier
 * @param {boolean} healthy - Whether this used findHealthy() vs find()
 * @param {string|undefined} kyc - Client-side kyc filter
 * @param {string|undefined} status - Client-side status filter
 * @returns {string}
 */
function buildCacheKey(filters, healthy, kyc, status) {
  return JSON.stringify({
    country: filters.country || null,
    direction: filters.direction || null,
    rail_in: filters.rail_in || null,
    rail_out: filters.rail_out || null,
    currency: filters.currency || null,
    freshOnly: filters.freshOnly === false ? false : true,
    limit: filters.limit || null,
    healthy: !!healthy,
    kyc: kyc || null,
    status: status || null
  });
}

/**
 * Build the Express app for the HTTP discovery transport.
 * @param {Object} [options]
 * @param {string[]} [options.relays] - Relay URLs (defaults to DEFAULT_RELAYS)
 * @param {Object} [options.querier] - Inject a Querier-shaped instance
 *   (must expose relays, find(), findHealthy(), close()). Used by tests to
 *   avoid hitting real relays; defaults to a real Querier otherwise.
 * @param {number} [options.cacheTtlMs] - How long a /v1/services response is
 *   cached, in milliseconds. Pass 0 to disable caching entirely (default 30000).
 * @param {number} [options.rateLimitWindowMs] - Rate limit window in
 *   milliseconds (default 60000).
 * @param {number} [options.rateLimitMax] - Max requests per window per IP on
 *   /v1/services (default 30). Pass 0 or Infinity to disable rate limiting.
 * @returns {import('express').Express}
 */
function createHttpTransport({ relays, querier, cacheTtlMs, rateLimitWindowMs, rateLimitMax } = {}) {
  const q = querier || new Querier({ relays: relays || DEFAULT_RELAYS });
  const ttl = cacheTtlMs === undefined ? DEFAULT_CACHE_TTL_MS : cacheTtlMs;
  const cache = new Map(); // key -> { expiresAt, body }

  const app = express();

  // Open discovery: no auth, permissive CORS so browser-based wallets can query directly.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/v1/health', (req, res) => {
    res.json({ status: 'ok', relays: q.relays, cache: { ttlMs: ttl, size: cache.size } });
  });

  const rateLimited = rateLimitMax === 0
    ? (req, res, next) => next()
    : createRateLimiter({
        windowMs: rateLimitWindowMs === undefined ? 60000 : rateLimitWindowMs,
        max: rateLimitMax === undefined ? 30 : rateLimitMax
      });

  app.get('/v1/services', rateLimited, async (req, res) => {
    const { country, direction, rail_in, rail_out, currency, kyc, status, healthy, limit, noCache } = req.query;

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

    const isHealthy = healthy === 'true';
    const cacheKey = buildCacheKey(filters, isHealthy, kyc, status);
    const bypassCache = ttl <= 0 || noCache === 'true';

    if (!bypassCache) {
      const hit = cache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(hit.body);
      }
    }

    try {
      let providers = isHealthy
        ? await q.findHealthy(filters)
        : await q.find(filters);

      // kyc/status aren't in the Nostr server-side filter set, so apply client-side.
      if (kyc) providers = providers.filter(p => p.kyc === String(kyc));
      if (status) providers = providers.filter(p => p.status === String(status));

      const body = {
        count: providers.length,
        services: providers.map(normalizeProvider)
      };

      if (!bypassCache) {
        cache.set(cacheKey, { expiresAt: Date.now() + ttl, body });
      }

      res.setHeader('X-Cache', 'MISS');
      res.json(body);
    } catch (err) {
      // Never cache failures — a relay hiccup shouldn't blank out results for
      // everyone else for the next 30 seconds.
      res.status(502).json({ error: 'discovery_failed', message: 'Unable to query discovery relays' });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  return app;
}

module.exports = { createHttpTransport };
