'use strict';
const assert = require('assert');
const stripeCheckout = require('../lib/stripeCheckout');
const revenueLedger = require('../lib/revenueLedger');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('OK ' + name); }
  catch (e) { failures++; console.error('FAIL ' + name + ' — ' + e.message); }
}

console.log('\n=== stripe checkout tests ===\n');

test('catalog lists midlife prices', () => {
  const cat = stripeCheckout.listCatalog();
  assert.ok(cat.length >= 5);
  assert.ok(cat.some((c) => c.key === 'guia-premium'));
});

test('isConfigured false without key', () => {
  assert.strictEqual(stripeCheckout.isConfigured(), false);
});

test('webhook completed marks VERIFIED', () => {
  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_verified_001',
        amount_total: 4700,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        created: Math.floor(Date.now() / 1000),
        metadata: {},
      },
    },
  };
  const r = stripeCheckout.handleWebhookEvent(event);
  assert.strictEqual(r.status, 'SUCCESS');
  assert.strictEqual(r.revenue_type, 'VERIFIED');
  assert.ok(revenueLedger.snapshot().REVENUE_VERIFIED >= 47);
});

test('duplicate session not double counted', () => {
  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_verified_001',
        amount_total: 4700,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        created: Math.floor(Date.now() / 1000),
      },
    },
  };
  const r = stripeCheckout.handleWebhookEvent(event);
  assert.strictEqual(r.result.duplicate, true);
});

(async () => {
  const r = await stripeCheckout.createCheckoutSession({ priceKey: 'guia-premium' });
  try {
    assert.strictEqual(r.status, 'BLOCKED');
    console.log('OK createCheckoutSession blocked without STRIPE_SECRET_KEY');
  } catch (e) {
    failures++;
    console.error('FAIL createCheckoutSession', e.message);
  }
  console.log('\n=== Results ===');
  if (failures) process.exit(1);
  console.log('All stripe checkout tests passed');
  process.exit(0);
})();
