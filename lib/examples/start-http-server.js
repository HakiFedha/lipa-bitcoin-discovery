/**
 * Starts the HTTP discovery transport.
 * Usage: node examples/start-http-server.js
 * Env:   PORT (default 8383)
 */

const { createHttpTransport } = require('../src/transports/http/server');

const port = process.env.PORT || 8383;
const app = createHttpTransport();

app.listen(port, () => {
  console.log(`Lipa Bitcoin Discovery HTTP transport listening on :${port}`);
  console.log(`  GET /v1/health`);
  console.log(`  GET /v1/services?country=TZ&direction=off-ramp&rail_out=m-pesa`);
});
