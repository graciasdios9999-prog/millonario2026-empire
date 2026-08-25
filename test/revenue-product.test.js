'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('OK ' + name); }
  catch (e) { failures++; console.error('FAIL ' + name + ' — ' + (e.message || e)); }
}

async function run() {
  console.log('\n=== FASE6 product/revenue/leads/analytics tests ===\n');
  const storePath = path.join(__dirname, '../data/empire_store.json');
  const eventsPath = path.join(__dirname, '../data/events.jsonl');
  try { if (fs.existsSync(storePath)) fs.unlinkSync(storePath); } catch (_) {}
  try { if (fs.existsSync(eventsPath)) fs.unlinkSync(eventsPath); } catch (_) {}

  const productEngine = require('../lib/productEngine');
  const revenueLedger = require('../lib/revenueLedger');
  const leads = require('../lib/leads');
  const analytics = require('../lib/analytics');
  const shopify = require('../lib/shopifyManager');

  test('shopify isConfigured false without env', () => {
    assert.strictEqual(shopify.isConfigured(), false);
  });
  test('catalog architecture has tiers', () => {
    const arch = productEngine.catalogArchitecture();
    assert.ok(arch.tiers.ENTRY && arch.tiers.CORE && arch.tiers.PREMIUM);
  });
  test('scoreProduct rewards complete offers', () => {
    const low = productEngine.scoreProduct({ title: 'x' });
    const high = productEngine.scoreProduct({
      title: 'Guia Reset Completa 40+',
      description: 'Programa completo de 30 dias con checklist y seguimiento.',
      benefits: ['Plan', 'Checklist', 'Comunidad'],
      tier: 'CORE',
      seoTitle: 'Guia Reset',
    });
    assert.ok(high > low);
    assert.ok(high >= 50);
  });

  const a = await productEngine.createProduct({
    title: 'Guia Reset Entry Offer',
    description: 'Entrada de bajo friccion para el programa midlife reset.',
    benefits: ['PDF', 'Checklist'],
    tier: 'ENTRY',
    dryRun: true,
    idempotencyKey: 'fase6-entry-1',
  });
  const b = await productEngine.createProduct({
    title: 'Guia Reset Entry Offer',
    description: 'Entrada de bajo friccion para el programa midlife reset.',
    benefits: ['PDF', 'Checklist'],
    tier: 'ENTRY',
    dryRun: true,
    idempotencyKey: 'fase6-entry-1',
  });
  test('product dry-run consistent handle', () => {
    assert.ok(a.product && a.product.handle);
    assert.strictEqual(a.product.handle, b.product.handle);
  });
  test('revenue VERIFIED from order only', () => {
    const r1 = revenueLedger.ingestShopifyOrder({ id: 777001, total_price: '29.99', currency: 'USD', financial_status: 'paid' });
    const r2 = revenueLedger.ingestShopifyOrder({ id: 777001, total_price: '29.99', currency: 'USD', financial_status: 'paid' });
    assert.strictEqual(r1.duplicate, false);
    assert.strictEqual(r2.duplicate, true);
    assert.strictEqual(revenueLedger.snapshot().REVENUE_VERIFIED, 29.99);
  });
  test('estimated never becomes verified', () => {
    revenueLedger.recordEstimated(9999, 'ai');
    assert.strictEqual(revenueLedger.snapshot().REVENUE_VERIFIED, 29.99);
  });
  test('leads idempotent by email', () => {
    const l1 = leads.captureLead({ email: 'Test@Example.com', source: 'landing' });
    const l2 = leads.captureLead({ email: 'test@example.com', source: 'landing' });
    assert.strictEqual(l1.duplicate, false);
    assert.strictEqual(l2.duplicate, true);
  });
  test('analytics tracks allowed events only', () => {
    assert.strictEqual(analytics.track('purchase', { value: 10 }).status, 'SUCCESS');
    assert.strictEqual(analytics.track('fake_event', {}).status, 'FAILED');
  });
  test('logger redacts secrets', () => {
    const logger = require('../lib/logger');
    const e = logger.info('t', 'SUCCESS', { api_key: 'sk-abc', n: 1 });
    assert.strictEqual(e.api_key, '[REDACTED]');
  });

  console.log('\n=== Results ===');
  if (failures) { console.error(failures + ' failed'); process.exit(1); }
  console.log('All FASE6 tests passed');
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
