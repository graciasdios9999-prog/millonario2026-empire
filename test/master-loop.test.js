/**
 * Real regression tests for millonario2026-empire critical modules.
 * Run: npm test
 *
 * These tests intentionally avoid calling external APIs.
 */

'use strict';

const assert = require('assert');
const path = require('path');

let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
  }
}

console.log('=== millonario2026-empire basic tests ===\n');

test('require(src/master-loop.js) succeeds and exports masterLoop function', () => {
  const mod = require(path.join(__dirname, '../src/master-loop.js'));
  assert.ok(mod, 'module should exist');
  assert.strictEqual(typeof mod.masterLoop, 'function', 'masterLoop must be a function');
  assert.strictEqual(mod.masterLoop.length, 0, 'masterLoop takes no required args');
});

test('src/index.js dependencies resolve (master-loop + express + cron)', () => {
  const ml = require(path.join(__dirname, '../src/master-loop.js'));
  assert.ok(ml.masterLoop);
  require('express');
  require('node-cron');
});

test('lib/config.js loads and exposes getConfig', () => {
  const config = require(path.join(__dirname, '../lib/config.js'));
  assert.ok(config);
  assert.strictEqual(typeof config.getConfig, 'function');
  const c = config.getConfig({ strict: false });
  assert.ok(typeof c === 'object');
  assert.ok(!String(c.WHATSAPP_ACCESS_TOKEN || '').startsWith('EAA'), 'must not contain hardcoded WhatsApp token');
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

test('lib/selfStudyAgent.js loads without OPENAI_API_KEY and exports autonomousSelfStudy', () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete require.cache[require.resolve(path.join(__dirname, '../lib/selfStudyAgent.js'))];
  const mod = require(path.join(__dirname, '../lib/selfStudyAgent.js'));
  assert.strictEqual(typeof mod.autonomousSelfStudy, 'function');
  if (original !== undefined) process.env.OPENAI_API_KEY = original;
});

test('lib/shopifyManager.js loads and exports expected functions', () => {
  delete require.cache[require.resolve(path.join(__dirname, '../lib/shopifyManager.js'))];
  const mod = require(path.join(__dirname, '../lib/shopifyManager.js'));
  assert.strictEqual(typeof mod.createProduct, 'function');
  assert.strictEqual(typeof mod.getOrders, 'function');
  assert.strictEqual(typeof mod.isConfigured, 'function');
  assert.strictEqual(mod.isConfigured(), false);
});

test('src/webhooks/whatsapp.js loads as Express router', () => {
  delete require.cache[require.resolve(path.join(__dirname, '../src/webhooks/whatsapp.js'))];
  const router = require(path.join(__dirname, '../src/webhooks/whatsapp.js'));
  assert.ok(router);
  assert.ok(typeof router === 'function' || (router && router.stack));
});

test('package.json defines a test script', () => {
  const pkg = require(path.join(__dirname, '../package.json'));
  assert.ok(pkg.scripts && pkg.scripts.test, 'scripts.test must exist');
});

console.log('\n=== Results ===');
if (failures > 0) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
console.log('All tests passed');
process.exit(0);
