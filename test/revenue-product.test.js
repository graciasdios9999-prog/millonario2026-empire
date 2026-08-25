/**
 * Tests for product engine idempotency + revenue ledger VERIFIED vs ESTIMATED.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let failures = 0;
function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      throw new Error('async test must be awaited externally');
    }
    console.log('OK ' + name);
  } catch (e) {
    failures++;
    console.error('FAIL ' + name + ' — ' + (e.message || e));
  }
}

async function run() {
  console.log('\n=== revenue + product engine tests ===\n');

  const storePath = path.join(__dirname, '../data/empire_store.json');
  try {
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  } catch (_) {}

  const productEngine = require('../lib/productEngine');
  const revenueLedger = require('../lib/revenueLedger');

  test('catalog architecture exposes offer tiers', () => {
    const arch = productEngine.catalogArchitecture();
    assert.ok(arch.ENTRY && arch.CORE && arch.PREMIUM && arch.BUNDLE);
    assert.ok(Array.isArray(arch.funnel));
  });

  test('buildProductPayload creates SEO + price + tags', () => {
    const payload = productEngine.buildProductPayload({
      title: 'Guia Reset 40+',
      tier: 'CORE',
      benefits: ['Plan 30 dias', 'Checklist'],
    });
    assert.strictEqual(payload.title, 'Guia Reset 40+');
    assert.ok(payload.variants[0].price);
    assert.ok(String(payload.tags).includes('offer:core'));
  });

  const input = {
    title: 'Test Product Idem',
    tier: 'ENTRY',
    dryRun: true,
    idempotencyKey: 'test-key-001',
  };
  const a = await productEngine.createProduct(input);
  const b = await productEngine.createProduct(input);
  test('createProduct dry-run returns consistent handle', () => {
    assert.ok(a.status === 'BLOCKED' || a.status === 'SUCCESS');
    assert.strictEqual(a.product.handle, b.product.handle);
  });

  test('revenue snapshot starts with structure', () => {
    const snap = revenueLedger.snapshot();
    assert.ok('REVENUE_VERIFIED' in snap);
    assert.ok(snap.note);
  });

  const order = {
    id: 999001,
    total_price: '49.00',
    currency: 'USD',
    financial_status: 'paid',
  };
  const r1 = revenueLedger.ingestShopifyOrder(order);
  const r2 = revenueLedger.ingestShopifyOrder(order);
  test('ingestShopifyOrder marks VERIFIED and is idempotent', () => {
    assert.strictEqual(r1.revenue_type, 'VERIFIED');
    assert.strictEqual(r1.duplicate, false);
    assert.strictEqual(r2.duplicate, true);
    const snap = revenueLedger.snapshot();
    assert.strictEqual(snap.REVENUE_VERIFIED, 49);
    assert.strictEqual(snap.ORDERS_VERIFIED, 1);
  });

  test('recordEstimated never becomes VERIFIED', () => {
    const e = revenueLedger.recordEstimated(10000, 'ai_prediction');
    assert.strictEqual(e.revenue_type, 'ESTIMATED');
    const snap = revenueLedger.snapshot();
    assert.strictEqual(snap.REVENUE_VERIFIED, 49);
  });

  test('logger redacts token-like keys', () => {
    const logger = require('../lib/logger');
    const entry = logger.info('test.op', 'SUCCESS', { api_key: 'sk-secret', amount: 1 });
    assert.strictEqual(entry.api_key, '[REDACTED]');
    assert.strictEqual(entry.amount, 1);
  });

  console.log('\n=== Results ===');
  if (failures) {
    console.error(failures + ' failed');
    process.exit(1);
  }
  console.log('All product/revenue tests passed');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
