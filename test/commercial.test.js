'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('OK ' + name);
  } catch (e) {
    failures++;
    console.error('FAIL ' + name + ' — ' + (e.message || e));
  }
}

console.log('\n=== commercial engine tests ===\n');

const dataDir = path.join(__dirname, '../data');
for (const f of ['events.json', 'leads.json', 'empire_store.json']) {
  try {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}

const offerEngine = require('../lib/offerEngine');
const analytics = require('../lib/analytics');
const leadStore = require('../lib/leadStore');
const productEngine = require('../lib/productEngine');
const revenueLedger = require('../lib/revenueLedger');

test('scoreProduct returns publishReady for strong signals', () => {
  const s = offerEngine.scoreProduct({
    demand: 90, margin: 80, competition: 20, priceFit: 80,
    aovPotential: 70, upsellPotential: 70, repeatPotential: 60,
  });
  assert.ok(s.score >= 60);
  assert.strictEqual(s.publishReady, true);
  assert.strictEqual(s.recommendation, 'PUBLISH_CANDIDATE');
});

test('scoreProduct rejects weak products', () => {
  const s = offerEngine.scoreProduct({
    demand: 10, margin: 10, competition: 90, priceFit: 10,
    aovPotential: 10, upsellPotential: 10, repeatPotential: 10,
  });
  assert.ok(s.score < 40);
  assert.strictEqual(s.recommendation, 'SKIP');
});

test('buildOfferStack creates ENTRY..CROSS_SELL', () => {
  const stack = offerEngine.buildOfferStack({ title: 'Reset Guide', price: 29.99 });
  assert.ok(stack.ENTRY && stack.CORE && stack.PREMIUM && stack.BUNDLE && stack.UPSELL);
  assert.ok(stack.ENTRY.suggestedPrice < stack.CORE.suggestedPrice);
});

test('analytics tracks allowed events only', () => {
  const ok = analytics.track('page_view', { sessionId: 's1' });
  assert.strictEqual(ok.status, 'SUCCESS');
  const bad = analytics.track('fake_money', {});
  assert.strictEqual(bad.status, 'FAILED');
});

test('lead capture dedupes by email', () => {
  const a = leadStore.captureLead({ email: 'Test@Example.com', source: 'landing' });
  const b = leadStore.captureLead({ email: 'test@example.com', source: 'landing' });
  assert.strictEqual(a.duplicate, false);
  assert.strictEqual(b.duplicate, true);
  assert.strictEqual(leadStore.count(), 1);
});

test('revenue ledger never treats estimated as verified', () => {
  revenueLedger.recordEstimated(9999, 'ai');
  const before = revenueLedger.snapshot().REVENUE_VERIFIED;
  revenueLedger.recordEstimated(50000, 'ai');
  assert.strictEqual(revenueLedger.snapshot().REVENUE_VERIFIED, before);
});

test('productEngine payload has SEO fields', () => {
  const p = productEngine.buildProductPayload({
    title: 'Guia Premium', tier: 'PREMIUM', description: 'Programa completo de reset',
  });
  assert.ok(p.metafields_global_title_tag);
  assert.ok(p.metafields_global_description_tag);
  assert.ok(String(p.tags).includes('offer:premium'));
});

console.log('\n=== Results ===');
if (failures) {
  console.error(failures + ' failed');
  process.exit(1);
}
console.log('All commercial tests passed');
process.exit(0);
