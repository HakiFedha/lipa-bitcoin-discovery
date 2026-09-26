const { SimplePool, finalizeEvent } = require('nostr-tools');
const { KINDS, DEFAULT_RELAYS, DEFAULT_TTL, FILTER_TAGS, ALT_TEXT, PROTOCOL_VERSION, VOCAB, DEFAULT_SERVICE_TYPE, RAIL_OUT_REQUIRED_FOR } = require('./config');
const { loadKeys, loadKeysFromEnv } = require('./keys');

class Publisher {
  /**
   * Create a Publisher instance.
   * @param {Object} options
   * @param {string} options.privateKey - Hex-encoded Nostr private key
   * @param {string[]} [options.relays] - Relay URLs (defaults to 3 public relays)
   */
  constructor({ privateKey, relays }) {
    if (!privateKey) {
      throw new Error('privateKey is required');
    }
    const keys = loadKeys(privateKey);
    this.secretKeyBytes = keys.secretKeyBytes;
    this.publicKey = keys.publicKey;
    this.relays = relays || DEFAULT_RELAYS;
    this.pool = new SimplePool();
  }

  /**
   * Create a Publisher from an environment variable.
   * @param {string} [envVar='NOSTR_PRIVATE_KEY']
   * @param {string[]} [relays]
   * @returns {Publisher}
   */
  static fromEnv(envVar = 'NOSTR_PRIVATE_KEY', relays) {
    const keys = loadKeysFromEnv(envVar);
    return new Publisher({ privateKey: keys.privateKey, relays });
  }

  /**
   * Validate a listing's field formats and vocabularies. Throws on the first
   * problem with a clear message. Called by buildEvent after the presence check.
   * @param {Object} listing
   */
  _validate(listing) {
    const inSet = (field, value, allowed) => {
      if (!allowed.includes(value)) {
        throw new Error(`Field "${field}" must be one of: ${allowed.join(', ')} (got "${value}")`);
      }
    };

    const validateRails = (side) => {
      const rails = listing.rails && listing.rails[side];
      if (!Array.isArray(rails)) {
        throw new Error(`Field "rails.${side}" must be an array`);
      }
      for (const rail of rails) {
        inSet(`rails.${side}`, rail, VOCAB.rail);
      }
    };

    // ISO 3166-1 alpha-2 (two letters) and ISO 4217 (three letters), case-insensitive
    if (!/^[A-Za-z]{2}$/.test(listing.country)) {
      throw new Error(`Field "country" must be a 2-letter ISO 3166-1 alpha-2 code (got "${listing.country}")`);
    }
    if (!/^[A-Za-z]{3}$/.test(listing.currency)) {
      throw new Error(`Field "currency" must be a 3-letter ISO 4217 code (got "${listing.currency}")`);
    }

    inSet('direction', listing.direction, VOCAB.direction);
    validateRails('in');
    validateRails('out');
    if (listing.service_type !== undefined && listing.service_type !== null) {
      inSet('service_type', listing.service_type, VOCAB.service_type);
    }
    if (listing.status !== undefined) inSet('status', listing.status, VOCAB.status);
    if (listing.status_reason !== undefined && listing.status_reason !== null) {
      if (listing.status !== 'paused') {
        throw new Error('Field "status_reason" is only valid when "status" is "paused"');
      }
      inSet('status_reason', listing.status_reason, VOCAB.status_reason);
    }
    if (listing.kyc !== undefined && listing.kyc !== null) inSet('kyc', listing.kyc, VOCAB.kyc);
    if (listing.speed !== undefined && listing.speed !== null) inSet('speed', listing.speed, VOCAB.speed);

    // Endpoint and health are optional, but must use https when supplied.
    for (const field of ['endpoint', 'health']) {
      if (listing[field] === undefined || listing[field] === null) continue;
      let url;
      try { url = new URL(listing[field]); } catch {
        throw new Error(`Field "${field}" must be a valid URL (got "${listing[field]}")`);
      }
      if (url.protocol !== 'https:') {
        throw new Error(`Field "${field}" must use https (got "${url.protocol}//…")`);
      }
    }
  }

  /**
   * Build a service listing event from a config object.
   * @param {Object} listing - Service listing configuration
   * @param {string} listing.id - Unique service ID (e.g. 'provider-a-tz-offramp')
   * @param {string} listing.name - Provider name
   * @param {string} listing.country - ISO 3166-1 alpha-2 country code
   * @param {string} listing.direction - 'off-ramp' | 'on-ramp' | 'both'
   * @param {string[]} listing.rails.in - Rails used to send value into the service
   * @param {string[]} listing.rails.out - Rails used to receive value from the service. Required for 'currency-exchange' and 'remittance'; optional otherwise.
   * @param {string} [listing.service_type='currency-exchange'] - 'currency-exchange' | 'remittance' | 'airtime-data' | 'bill-payment' | 'merchant-payment'
   * @param {string} [listing.product] - Free-text product/destination for airtime-data, bill-payment, or merchant-payment (e.g. a carrier or merchant name)
   * @param {string} listing.currency - ISO 4217 currency code
   * @param {string} [listing.endpoint] - API base URL, when available
   * @param {string} [listing.health] - Health check URL, when available
   * @param {string} [listing.status='active'] - 'active' | 'inactive' | 'paused'
   * @param {string} [listing.status_reason] - Only valid when status is 'paused': 'out_of_float' | 'maintenance' | 'regulatory' | 'other'
   * @param {string} [listing.network] - Bitcoin network (e.g. mainnet, testnet)
   * @param {string} [listing.min_amount] - Minimum in local currency
   * @param {string} [listing.max_amount] - Maximum in local currency
   * @param {string} [listing.fee_range] - Fee percentage range
   * @param {string} [listing.speed] - 'seconds' | 'minutes' | 'hours'
   * @param {string} [listing.ttl] - Seconds until stale
   * @param {string} [listing.protocols] - Supported Lightning protocols
   * @param {string} [listing.kyc] - 'none' | 'light' | 'full'
   * @param {Object} [listing.metadata] - Extended metadata for content field
   * @returns {Object} Signed Nostr event
   */
  buildEvent(listing) {
    // service_type defaults to currency-exchange, preserving the meaning of
    // every listing published before this field existed.
    const serviceType = listing.service_type || DEFAULT_SERVICE_TYPE;

    // Validate required fields. rails.in must contain at least one rail.
    // rails.out is required for service types that genuinely deliver value
    // through an outbound rail (currency-exchange, remittance).
    const required = ['id', 'name', 'country', 'direction', 'currency'];
    for (const field of required) {
      if (!listing[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
      if (typeof listing[field] !== 'string') {
        throw new Error(`Field "${field}" must be a string, got ${typeof listing[field]}`);
      }
    }

    if (!listing.rails || !Array.isArray(listing.rails.in)) {
      throw new Error('Missing required field: rails.in');
    }
    if (listing.rails.in.length === 0) {
      throw new Error('Field "rails.in" must contain at least one rail');
    }
    if (!listing.rails.out || !Array.isArray(listing.rails.out)) {
      if (RAIL_OUT_REQUIRED_FOR.includes(serviceType)) {
        throw new Error('Missing required field: rails.out');
      }
      listing.rails = { ...listing.rails, out: [] };
    }
    if (RAIL_OUT_REQUIRED_FOR.includes(serviceType) && listing.rails.out.length === 0) {
      throw new Error(`Field "rails.out" must contain at least one rail for service type "${serviceType}"`);
    }
    this._validate(listing);

    // Build tags array.
    // Filterable fields use single-letter tags (c/o/i/m/f) so relays index them
    // for server-side filtering. Display fields keep readable multi-letter names.
    const tags = [
      ['d', listing.id],
      ['alt', ALT_TEXT[KINDS.SERVICE_LISTING]],          // NIP-31 human description
      ['v', PROTOCOL_VERSION],                            // protocol version
      [FILTER_TAGS.country, listing.country.toUpperCase()],
      [FILTER_TAGS.direction, listing.direction],
      [FILTER_TAGS.service_type, serviceType],
      [FILTER_TAGS.currency, listing.currency.toUpperCase()],
      ['name', listing.name],
      ['status', listing.status || 'active']
    ];

    if (listing.status_reason) {
      tags.push(['status_reason', listing.status_reason]);
    }

    // Emit one filterable Nostr tag for every inbound and outbound rail.
    for (const rail of listing.rails.in) {
      tags.push([FILTER_TAGS.rail_in, rail]);
    }
    for (const rail of listing.rails.out) {
      tags.push([FILTER_TAGS.rail_out, rail]);
    }

    // Add optional tags
    const optional = {
      endpoint: listing.endpoint,
      health: listing.health,
      product: listing.product,
      network: listing.network,
      min_amount: listing.min_amount,
      max_amount: listing.max_amount,
      fee_range: listing.fee_range,
      speed: listing.speed,
      ttl: listing.ttl || String(DEFAULT_TTL),
      protocols: listing.protocols,
      kyc: listing.kyc,
      lnaddr: listing.lnaddr
    };

    for (const [key, value] of Object.entries(optional)) {
      if (value !== undefined && value !== null) {
        tags.push([key, String(value)]);
      }
    }

    // Build and sign the event
    const event = finalizeEvent({
      kind: KINDS.SERVICE_LISTING,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: listing.metadata ? JSON.stringify(listing.metadata) : '{}'
    }, this.secretKeyBytes);

    return event;
  }

  /**
   * Publish a service listing to all configured relays.
   * @param {Object} listing - Service listing configuration (see buildEvent)
   * @returns {Promise<{ success: string[], failed: string[] }>} Results per relay
   */
  async publish(listing) {
    const event = this.buildEvent(listing);
    const results = { success: [], failed: [], eventId: event.id, pubkey: this.publicKey };

    const promises = this.pool.publish(this.relays, event);

    for (let i = 0; i < promises.length; i++) {
      try {
        await promises[i];
        results.success.push(this.relays[i]);
      } catch (err) {
        results.failed.push({ relay: this.relays[i], error: err.message || String(err) });
      }
    }

    return results;
  }

  /**
   * Update status and republish (for pausing, going inactive, etc).
   * @param {Object} listing - Full listing config with updated status
   * @returns {Promise<{ success: string[], failed: string[] }>}
   */
  async updateStatus(listing) {
    return this.publish(listing);
  }

  /**
   * Close all relay connections.
   */
  close() {
    this.pool.close(this.relays);
  }
}

module.exports = { Publisher };
