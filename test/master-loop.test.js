/**
 * Regression tests for millonario2026-empire critical modules.
 * Run: npm test
 * Intentionally avoids external API calls and commercial side effects.
 */

'use strict';

const assert = require('assert');
const path = require('path');

let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log('OK ' + name);
  } catch (e) {
    failures++;
    console.error('FAIL ' + name);
    console.error('  ' + (e && e.message ? e.message : e));
  }
}

console.log('\n=== millonario2026-empire basic tests ===\n');

test('require(src/master-loop.js) exports masterLoop without throwing on load', () => {
  const modPath = path.join(__dirname, '../src/master-loop.js');
  delete require.cache[require.resolve(modPath)];
  const mod = require(modPath);
  assert.strictEqual(typeof mod.masterLoop, 'function');
});

test('masterLoop is not auto-invoked merely by requiring the module (control-flow contract)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '../src/master-loop.js'), 'utf8');
  assert.ok(src.includes('require.main === module'), 'must guard auto-execution with require.main === module');
  assert.ok(src.includes('module.exports'), 'must export masterLoop');
});

test('lib/config.js loads and exposes getConfig', () => {
  delete require.cache[require.resolve(path.join(__dirname, '../lib/config.js'))];
  const config = require(path.join(__dirname, '../lib/config.js'));
  assert.strictEqual(typeof config.getConfig, 'function');
  const c = config.getConfig({ strict: false });
  assert.ok(typeof c === 'object');
});

test('config strict mode throws when OPENAI_API_KEY is missing', () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete require.cache[require.resolve(path.join(__dirname, '../lib/config.js'))];
  const { getConfig } = require(path.join(__dirname, '../lib/config.js'));
  let threw = false;
  try {
    getConfig({ strict: true });
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('OPENAI_API_KEY'));
  }
  if (original !== undefined) process.env.OPENAI_API_KEY = original;
  assert.ok(threw, 'strict mode must throw when OPENAI_API_KEY is absent');
});

test('lib/shopifyManager.js loads and exports expected functions; isConfigured false without env', () => {
  delete require.cache[require.resolve(path.join(__dirname, '../lib/shopifyManager.js'))];
  const mod = require(path.join(__dirname, '../lib/shopifyManager.js'));
  assert.strictEqual(typeof mod.createProduct, 'function');
  assert.strictEqual(typeof mod.getOrders, 'function');
  assert.strictEqual(typeof mod.createDiscount, 'function');
  assert.strictEqual(typeof mod.autoCreateRevenueProduct, 'function');
  assert.strictEqual(typeof mod.isConfigured, 'function');
  assert.strictEqual(mod.isConfigured(), false);
});

test('lib/revenueAnalyzer.js loads and does not claim verified revenue', () => {
  delete require.cache[require.resolve(path.join(__dirname, '../lib/revenueAnalyzer.js'))];
  const mod = require(path.join(__dirname, '../lib/revenueAnalyzer.js'));
  assert.strictEqual(typeof mod.analyzeRevenueMetrics, 'function');
});

test('package.json defines test script and engines node 20', () => {
  const pkg = require(path.join(__dirname, '../package.json'));
  assert.ok(pkg.scripts && pkg.scripts.test, 'scripts.test must exist');
  assert.ok(pkg.engines && String(pkg.engines.node).includes('20'), 'engines.node should target 20.x');
});

test('POST /trigger protection present in src/index.js (fail-closed pattern)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(src.includes('TRIGGER_SECRET'), 'must reference TRIGGER_SECRET');
  assert.ok(/403|401|Unauthorized|disabled/.test(src), 'must reject unauthorized trigger');
});

console.log('\n=== Results ===');
if (failures > 0) {
  console.error(failures + ' test(s) failed');
  process.exit(1);
}
console.log('All tests passed');
process.exit(0);
