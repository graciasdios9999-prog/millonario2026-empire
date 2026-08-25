'use strict';
const assert = require('assert');
const stripeCheckout = require('../lib/stripeCheckout');
const revenueLedger = require('../lib/revenueLedger');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('OK ' + name); }
  catch (e) { failures++; console.error('FAIL ' + name + ' — ' + e.message); }
}

console.log('\n=== fase9 revenue / security tests ===\n');

test('rejects client-supplied price amount', () => {
  const r = stripeCheckout.resolveCatalogEntry({ priceKey: 'guia-premium', amount: 1 });
  assert.strictEqual(r.error, 'client_price_rejected');
});
test('rejects unknown priceId', () => {
  const r = stripeCheckout.resolveCatalogEntry({ priceId: 'price_fake_xxx' });
  assert.strictEqual(r.error, 'unknown_price_id');
});
test('resolves guia-premium server-side at 4700 cents', () => {
  const r = stripeCheckout.resolveCatalogEntry({ priceKey: 'guia-premium' });
  assert.ok(r.entry);
  assert.strictEqual(r.entry.amount, 4700);
});
test('verified order stores attribution', () => {
  const id = 'cs_attr_test_' + Date.now();
  const r = revenueLedger.ingestShopifyOrder({
    id, total_price: 47, currency: 'usd', financial_status: 'paid', source: 'stripe_checkout',
    product_key: 'guia-premium', offer_id: 'offer_guia_47',
    attribution: { utm_source: 'facebook', utm_campaign: 'midlife_q1' },
  });
  assert.strictEqual(r.duplicate, false);
  assert.strictEqual(r.order.attribution.utm_source, 'facebook');
  const snap = revenueLedger.snapshot();
  assert.ok(snap.by_source.facebook >= 47);
});
test('refund reduces NET context', () => {
  const orderId = 'cs_ref_order_' + Date.now();
  revenueLedger.ingestShopifyOrder({
    id: orderId, total_price: 47, currency: 'usd', financial_status: 'paid',
    source: 'stripe_checkout', product_key: 'guia-premium',
  });
  revenueLedger.ingestRefund({ id: 'ch_ref_' + Date.now(), order_id: orderId, amount: 47, currency: 'usd' });
  const after = revenueLedger.snapshot();
  assert.ok(after.REVENUE_REFUNDED >= 47);
  assert.ok(after.NET_REVENUE <= after.REVENUE_VERIFIED);
});
test('duplicate refund is idempotent', () => {
  const id = 'ch_dup_ref_fixed2';
  revenueLedger.ingestRefund({ id, amount: 10, currency: 'usd' });
  const b = revenueLedger.ingestRefund({ id, amount: 10, currency: 'usd' });
  assert.strictEqual(b.duplicate, true);
});
test('webhook refund event handled', () => {
  const r = stripeCheckout.handleWebhookEvent({
    type: 'charge.refunded',
    data: { object: { id: 'ch_wh_ref_' + Date.now(), amount_refunded: 4700, amount: 4700, currency: 'usd', payment_intent: 'pi_test' } },
  });
  assert.strictEqual(r.status, 'SUCCESS');
  assert.strictEqual(r.revenue_type, 'REFUNDED');
});
test('webhook completed carries product metadata', () => {
  const id = 'cs_meta_' + Date.now();
  const r = stripeCheckout.handleWebhookEvent({
    type: 'checkout.session.completed',
    data: {
      object: {
        id, amount_total: 4700, currency: 'usd', payment_status: 'paid', status: 'complete',
        created: Math.floor(Date.now() / 1000),
        metadata: { price_key: 'guia-premium', offer_id: 'offer_guia_47', utm_source: 'youtube', utm_campaign: 'organic' },
      },
    },
  });
  assert.strictEqual(r.status, 'SUCCESS');
  assert.strictEqual(r.result.order.product_key, 'guia-premium');
  assert.strictEqual(r.result.order.attribution.utm_source, 'youtube');
});

(async () => {
  const blocked = await stripeCheckout.createCheckoutSession({ priceKey: 'guia-premium', amount: 1 });
  try {
    assert.strictEqual(blocked.status, 'FAILED');
    assert.strictEqual(blocked.error, 'client_price_rejected');
    console.log('OK createCheckoutSession rejects client amount');
  } catch (e) {
    failures++;
    console.error('FAIL', e.message);
  }
  console.log('\n=== Results ===');
  if (failures) process.exit(1);
  console.log('All fase9 revenue tests passed');
  process.exit(0);
})();
