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
 *    GET /.well-known/lipa
 *
 * The response uses the canonical Lipa service representation.
 */

const express = require('express');

const WELL_KNOWN_PATH = '/.well-known/lipa';

/**
 * Validate a provider-hosted discovery document against the Lipa specification.
 *
 * @param {Object} doc - Provider-hosted discovery document
 */
function validateProviderHostedDocument(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new TypeError('document is required and must be an object');
  }
  if (doc.protocol !== 'lipa') {
    throw new Error('Invalid or missing protocol field: must be "lipa"');
  }
  if (!doc.version || typeof doc.version !== 'string') {
    throw new Error('Invalid or missing version field');
  }
  if (!doc.provider || typeof doc.provider !== 'object' || !doc.provider.name || typeof doc.provider.name !== 'string') {
    throw new Error('Invalid or missing provider.name field');
  }
  if (doc.provider.pubkey && !/^[0-9a-f]{64}$/i.test(doc.provider.pubkey)) {
    throw new Error('Invalid provider.pubkey: must be a 64-character hex string');
  }
  if (!Array.isArray(doc.services) || doc.services.length === 0) {
    throw new Error('services must be a non-empty array');
  }

  for (const [index, service] of doc.services.entries()) {
    if (!service || typeof service !== 'object') {
      throw new Error(`Service at index ${index} must be an object`);
    }
    if (!service.id || typeof service.id !== 'string') {
      throw new Error(`Service at index ${index} missing required string "id"`);
    }
    if (!Array.isArray(service.countries) || service.countries.length === 0) {
      throw new Error(`Service "${service.id}" missing required array "countries"`);
    }
    if (!['on-ramp', 'off-ramp', 'both'].includes(service.direction)) {
      throw new Error(`Service "${service.id}" invalid "direction": must be "on-ramp", "off-ramp", or "both"`);
    }
    if (!service.rails || typeof service.rails !== 'object' || !Array.isArray(service.rails.in)) {
      throw new Error(`Service "${service.id}" missing required "rails.in" array`);
    }
    if (!Array.isArray(service.currencies) || service.currencies.length === 0) {
      throw new Error(`Service "${service.id}" missing required array "currencies"`);
    }
    if (!['active', 'inactive', 'paused'].includes(service.status)) {
      throw new Error(`Service "${service.id}" invalid "status": must be "active", "inactive", or "paused"`);
    }
    if (service.status_reason !== undefined) {
      if (service.status !== 'paused') {
        throw new Error(`Service "${service.id}" "status_reason" is only valid when "status" is "paused"`);
      }
      if (!['out_of_float', 'maintenance', 'regulatory', 'other'].includes(service.status_reason)) {
        throw new Error(`Service "${service.id}" invalid "status_reason": must be "out_of_float", "maintenance", "regulatory", or "other"`);
      }
    }
  }
}

/**
 * Build an Express app for provider-hosted discovery.
 *
 * @param {Object} options
 * @param {Object} options.document - Provider-hosted discovery document
 * @returns {import('express').Express}
 */
function createProviderHostedTransport({ document } = {}) {
  validateProviderHostedDocument(document);

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
  validateProviderHostedDocument,
  WELL_KNOWN_PATH
};
