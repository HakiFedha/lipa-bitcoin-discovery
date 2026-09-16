/**
 * core/normalize
 *
 * Maps a transport-specific parsed listing into the canonical, transport-
 * independent service description defined in spec/data-model.md section 2.
 *
 * Today the only source is the Nostr Querier's parsed provider object. When
 * an HTTP-native provider (one not discovered via Nostr) is added, it should
 * get its own normalizer that produces the same canonical shape.
 */

/**
 * Normalize a Nostr-sourced parsed provider (from Querier._parseEvent) into
 * the canonical service description.
 * @param {Object} p - Parsed provider object from Querier
 * @returns {Object} Canonical service description
 */
function normalizeProvider(p) {
  return {
    id: `${p.pubkey}:${p.id}`,
    provider: {
      name: p.name || null,
      pubkey: p.pubkey
    },
    countries: p.country ? [p.country] : [],
    direction: p.direction || null,
    service_type: p.service_type || 'currency-exchange',
    product: p.product || null,
    rails: {
      in: p.rail_in ? [p.rail_in] : [],
      out: p.rail_out ? [p.rail_out] : []
    },
    currencies: p.currency ? [p.currency] : [],
    endpoint: p.endpoint || null,
    health: p.health || null,
    status: p.status || null,
    network: p.network || null,
    min_amount: p.min_amount || null,
    max_amount: p.max_amount || null,
    fee_range: p.fee_range || null,
    speed: p.speed || null,
    protocols: p.protocols || [],
    lnaddr: p.lnaddr || null,
    kyc: p.kyc || null,
    ttl: p.ttl || null,
    metadata: p.metadata || {},
    _source: {
      transport: 'nostr',
      event_id: p.eventId,
      published_at: p.publishedAt
    }
  };
}

module.exports = { normalizeProvider };
