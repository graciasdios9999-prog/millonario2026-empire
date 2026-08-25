'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('OK ' + name); }
  catch (e) { failures++; console.error('FAIL ' + name + ' — ' + (e.message || e)); }
}

console.log('\n=== commercial engine tests ===\n');

const dataDir = path.join(__dirname, '../data');
for (const f of ['events.json', 'leads.json', 'empire_store.json']) {
  try { const p = path.join(dataDir, f); if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
}

const offerEngine = require('../lib/offerEngine');
const analytics = require('../lib/analytics');
const leadStore = require('../lib/leadStore');
const productEngine = require('../lib/productEngine');
const revenueLedger = require('../lib/revenueLedger');
const attribution = require('../lib/attribution');
const ceoDecisions = require('../lib/ceoDecisions');
const shopify = require('../lib/shopifyManager');

test('scoreProduct strong signals', () => {
  const s = offerEngine.scoreProduct({ demand: 90, margin: 80, competition: 20, priceFit: 80, aovPotential: 70, upsellPotential: 70, repeatPotential: 60 });
  assert.ok(s.score >= 60); assert.strictEqual(s.publishReady, true);
});
test('scoreProduct rejects weak', () => {
  const s = offerEngine.scoreProduct({ demand: 10, margin: 10, competition: 90, priceFit: 10, aovPotential: 10, upsellPotential: 10, repeatPotential: 10 });
  assert.ok(s.score < 40); assert.strictEqual(s.recommendation, 'SKIP');
});
test('buildOfferStack', () => {
  const stack = offerEngine.buildOfferStack({ title: 'Reset Guide', price: 29.99 });
  assert.ok(stack.ENTRY && stack.CORE && stack.PREMIUM);
});
test('offer rule percent cap', () => {
  assert.strictEqual(offerEngine.createOfferRule({ type: 'percent', value: 90 }).status, 'FAILED');
  assert.strictEqual(offerEngine.createOfferRule({ type: 'percent', value: 15 }).status, 'SUCCESS');
});
test('offer expiry', () => {
  const r = offerEngine.createOfferRule({ type: 'percent', value: 10, expiresAt: '2020-01-01T00:00:00.000Z' });
  assert.strictEqual(offerEngine.isOfferEligible(r.rule, {}).eligible, false);
});
test('analytics allowlist', () => {
  assert.strictEqual(analytics.track('page_view', { sessionId: 's1' }).status, 'SUCCESS');
  assert.strictEqual(analytics.track('fake_money', {}).status, 'FAILED');
});
test('analytics idempotency', () => {
  const a = analytics.track('page_view', { idempotencyKey: 'idem-1' });
  const b = analytics.track('page_view', { idempotencyKey: 'idem-1' });
  assert.strictEqual(a.duplicate, false); assert.strictEqual(b.duplicate, true);
});
test('lead dedupe', () => {
  assert.strictEqual(leadStore.captureLead({ email: 'A@Ex.com', source: 'x' }).duplicate, false);
  assert.strictEqual(leadStore.captureLead({ email: 'a@ex.com', source: 'x' }).duplicate, true);
});
test('estimated not verified', () => {
  const before = revenueLedger.snapshot().REVENUE_VERIFIED;
  revenueLedger.recordEstimated(99999, 'ai');
  assert.strictEqual(revenueLedger.snapshot().REVENUE_VERIFIED, before);
});
test('product SEO', () => {
  const p = productEngine.buildProductPayload({ title: 'Guia', tier: 'CORE', description: 'd' });
  assert.ok(p.metafields_global_title_tag);
});
test('attribution utm', () => {
  const t = attribution.buildTrackingParams({ source: 'youtube', campaign_id: 'c1' });
  assert.ok(t.query_string.includes('utm_campaign=c1'));
});
test('ceo decisions', () => {
  const d = ceoDecisions.prioritize();
  assert.ok(d.priorities.length > 0);
});
test('shopify not configured', () => {
  assert.strictEqual(shopify.isConfigured(), false);
});

console.log('\n=== Results ===');
if (failures) { console.error(failures + ' failed'); process.exit(1); }
console.log('All commercial tests passed');
process.exit(0);
