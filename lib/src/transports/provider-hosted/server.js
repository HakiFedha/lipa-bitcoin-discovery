/**
 * transports/provider-hosted/server
 *
 * Provider-hosted discovery transport.
 *
 * Serves a provider-owned Lipa service description from a predictable
 * web location, allowing applications to discover services directly
 * from the provider without relying on a central directory.
 *
 * Default route:
 *   GET /.well-known/lipa
 *
 * The response uses the canonical Lipa service representation.
 */

const express = require('express');

const WELL_KNOWN_PATH = '/.well-known/lipa';

/**
 * Build an Express app for provider-hosted discovery.
 *
 * @param {Object} options
 * @param {Object} options.document - Provider-hosted discovery document
 * @returns {import('express').Express}
 */
function createProviderHostedTransport({ document } = {}) {
  if (!document || typeof document !== 'object') {
    throw new TypeError('document is required');
  }

  const app = express();

  // Discovery is public and may be queried by browser-based applications.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });

  app.get(WELL_KNOWN_PATH, (req, res) => {
    res.json(document);
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  return app;
}

module.exports = {
  createProviderHostedTransport,
  WELL_KNOWN_PATH
};
