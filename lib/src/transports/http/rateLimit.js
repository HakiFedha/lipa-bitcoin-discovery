/**
 * transports/http/rateLimit
 *
 * A minimal in-memory sliding-window rate limiter, keyed by client IP.
 * Deliberately dependency-free and process-local: fine for a single-instance
 * deployment. If this ever runs as multiple instances behind a load balancer,
 * this should move to a shared store (e.g. Redis) instead.
 */

/**
 * Create an Express middleware that limits each IP to `max` requests per
 * `windowMs` milliseconds.
 * @param {Object} [options]
 * @param {number} [options.windowMs=60000] - Window size in milliseconds
 * @param {number} [options.max=30] - Max requests per window per IP
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter({ windowMs = 60000, max = 30 } = {}) {
  // ip -> array of request timestamps within the current window
  const hits = new Map();

  // Periodically drop IPs with no recent activity so the map doesn't grow
  // unbounded over a long-running process.
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of hits) {
      const fresh = timestamps.filter(t => t > cutoff);
      if (fresh.length === 0) hits.delete(ip);
      else hits.set(ip, fresh);
    }
  }, windowMs);
  if (sweeper.unref) sweeper.unref(); // don't keep the process alive just for this

  function middleware(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;

    const timestamps = (hits.get(ip) || []).filter(t => t > cutoff);
    timestamps.push(now);
    hits.set(ip, timestamps);

    const remaining = Math.max(0, max - timestamps.length);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (timestamps.length > max) {
      const oldestInWindow = timestamps[0];
      const retryAfterSec = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({
        error: 'rate_limited',
        message: `Too many requests. Limit is ${max} per ${Math.round(windowMs / 1000)}s.`
      });
    }

    next();
  }

  // Exposed for tests: reset all tracked state and stop the sweeper.
  middleware._reset = () => hits.clear();
  middleware._stop = () => clearInterval(sweeper);

  return middleware;
}

module.exports = { createRateLimiter };
