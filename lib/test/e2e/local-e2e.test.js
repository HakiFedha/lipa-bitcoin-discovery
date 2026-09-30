const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('local discovery and settlement flow completes end-to-end', () => {
  const demo = path.join(__dirname, '../../examples/local-e2e-demo.js');

  const result = spawnSync(process.execPath, [demo], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, `E2E demo failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /DONE/);
  assert.match(result.stdout, /Result: 1 provider\(s\) matched/);
  assert.match(result.stdout, /status: completed/);
});
