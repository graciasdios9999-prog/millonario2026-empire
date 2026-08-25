'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const stripeCheckout = require('../lib/stripeCheckout');
const ceoDecisions = require('../lib/ceoDecisions');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('OK ' + name); }
  catch (e) { failures++; console.error('FAIL ' + name + ' — ' + e.message); }
}

console.log('\n=== first-sale path tests ===\n');

test('offer landing exists', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '../public/offer.html')));
});
test('success and cancel pages exist', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '../public/success.html')));
  assert.ok(fs.existsSync(path.join(__dirname, '../public/cancel.html')));
});
test('guia-premium is ENTRY catalog item at $47', () => {
  const cat = stripeCheckout.listCatalog();
  const g = cat.find((c) => c.key === 'guia-premium');
  assert.ok(g);
  assert.strictEqual(g.amount_usd, 47);
  assert.strictEqual(g.mode, 'payment');
});
test('index wires stripe routes', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(src.includes("require('../lib/stripeCheckout')"));
  assert.ok(src.includes('/stripe/checkout'));
  assert.ok(src.includes('/stripe/catalog'));
  assert.ok(src.includes("require('./webhooks/stripe')"));
  assert.ok(src.includes('express.static'));
});
test('ceo decisions prioritizes stripe when missing', () => {
  const d = ceoDecisions.prioritize();
  assert.ok(Array.isArray(d.priorities));
  assert.strictEqual(d.stripe_configured, false);
  assert.ok(d.priorities.some((p) => p.id === 'stripe_secret'));
});

console.log('\n=== Results ===');
if (failures) { console.error(failures + ' failed'); process.exit(1); }
console.log('All first-sale path tests passed');
process.exit(0);
