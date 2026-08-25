/**
 * CEO-DIOS EMPIRE V20 — Commercial API
 */
'use strict';

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { masterLoop } = require('./master-loop');
const revenueLedger = require('../lib/revenueLedger');
const productEngine = require('../lib/productEngine');
const offerEngine = require('../lib/offerEngine');
const shopify = require('../lib/shopifyManager');
const logger = require('../lib/logger');
const analytics = require('../lib/analytics');
const leadStore = require('../lib/leadStore');
const store = require('../lib/store');
const ceoDecisions = require('../lib/ceoDecisions');
const attribution = require('../lib/attribution');

const app = express();
const PORT = process.env.PORT || 3000;
const TRIGGER_SECRET = process.env.TRIGGER_SECRET || '';
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(express.json({ limit: '1mb' }));

function requireTrigger(req, res) {
  const provided = req.get('X-Trigger-Secret') || req.get('x-trigger-secret') || (req.body && req.body.secret) || req.query.secret || '';
  if (!TRIGGER_SECRET) {
    res.status(403).json({ success: false, error: 'Endpoint disabled until TRIGGER_SECRET is set' });
    return false;
  }
  if (provided !== TRIGGER_SECRET) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

app.get('/', (req, res) => {
  res.json({ name: 'CEO-Dios Empire V20', status: 'operational', version: '20.0.0', mode: 'COMMERCIAL_ENGINE', env: NODE_ENV, uptime: process.uptime(), lastRun: global.lastRun || null, shopify_configured: shopify.isConfigured() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '20.0.0', env: NODE_ENV, uptime_s: process.uptime(), shopify_configured: shopify.isConfigured(), openai_configured: !!process.env.OPENAI_API_KEY, hubspot_configured: !!process.env.HUBSPOT_API_KEY, trigger_protected: !!TRIGGER_SECRET, internal_cron: process.env.ENABLE_INTERNAL_CRON === 'true', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  const checks = { config_loaded: true, trigger_secret: !!TRIGGER_SECRET, shopify_configured: shopify.isConfigured(), store_writable: true };
  try { store.listProducts(); } catch (e) { checks.store_writable = false; }
  if (shopify.isConfigured()) {
    const sh = await shopify.healthCheck();
    checks.shopify_reachable = sh.ok;
    if (!sh.ok) checks.shopify_error = sh.reason;
  } else {
    checks.shopify_reachable = null;
  }
  const criticalOk = checks.store_writable;
  res.status(criticalOk ? 200 : 503).json({
    ready: criticalOk,
    production_ready: criticalOk && checks.trigger_secret && checks.shopify_configured && checks.shopify_reachable === true,
    checks,
    note: 'production_ready requires TRIGGER_SECRET + live Shopify.',
  });
});

app.get('/status', (req, res) => {
  res.json({ status: 'alive', version: '20.0.0', modules: { heygen: !!process.env.HEYGEN_API_KEY, openai: !!process.env.OPENAI_API_KEY, youtube: !!process.env.YOUTUBE_REFRESH_TOKEN, facebook: !!process.env.FACEBOOK_PAGE_TOKEN, trading: !!process.env.ALPACA_API_KEY, shopify: shopify.isConfigured(), hubspot: !!process.env.HUBSPOT_API_KEY }, lastRun: global.lastRun || 'never', revenue: revenueLedger.snapshot() });
});

app.get('/metrics', (req, res) => {
  res.json({ revenue: revenueLedger.snapshot(), analytics: analytics.summary(), leads: leadStore.count(), products_local: store.listProducts().length, shopify_configured: shopify.isConfigured() });
});
app.get('/metrics/revenue', (req, res) => res.json(revenueLedger.snapshot()));
app.get('/metrics/products', (req, res) => {
  const products = store.listProducts();
  res.json({ count: products.length, products: products.map((p) => ({ id: p.id, title: p.title, handle: p.handle, tier: p.tier, price: p.price, shopify_product_id: p.shopify_product_id || null, status: p.status })) });
});
app.get('/metrics/orders', (req, res) => {
  const snap = revenueLedger.snapshot();
  res.json({ ORDERS_VERIFIED: snap.ORDERS_VERIFIED, REVENUE_VERIFIED: snap.REVENUE_VERIFIED, AOV_VERIFIED: snap.AOV_VERIFIED, note: snap.note });
});
app.get('/metrics/catalog', (req, res) => res.json(productEngine.catalogArchitecture()));
app.get('/catalog/architecture', (req, res) => res.json(productEngine.catalogArchitecture()));
app.get('/decisions', (req, res) => res.json(ceoDecisions.prioritize()));

app.post('/offers/score', (req, res) => {
  try { res.json(Object.assign({ success: true }, offerEngine.scoreProduct(req.body || {}))); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
app.post('/offers/stack', (req, res) => {
  try { res.json({ success: true, stack: offerEngine.buildOfferStack(req.body || {}) }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
app.post('/offers/rules', (req, res) => {
  try {
    const result = offerEngine.createOfferRule(req.body || {});
    res.status(result.status === 'FAILED' ? 400 : 200).json(result);
  } catch (e) { res.status(500).json({ status: 'FAILED', error: e.message }); }
});
app.post('/attribution', (req, res) => {
  res.json({ success: true, tracking: attribution.buildTrackingParams(req.body || {}) });
});

app.post('/products', async (req, res) => {
  if (!requireTrigger(req, res)) return;
  try {
    const input = Object.assign({}, req.body || {});
    if (input.dryRun !== false) input.dryRun = true;
    if (input.dryRun === false && !shopify.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Shopify not configured', status: 'BLOCKED' });
    }
    if (input.requireScore === true) {
      const scored = offerEngine.scoreProduct(input);
      if (!scored.publishReady) return res.status(422).json({ success: false, status: 'REJECTED', reason: 'score_below_threshold', score: scored });
    }
    const result = await productEngine.createProduct(input);
    res.status(result.status === 'FAILED' ? 500 : 200).json(Object.assign({ success: result.status !== 'FAILED' }, result));
  } catch (e) {
    logger.failed('api.products', { error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/leads', (req, res) => {
  try {
    const result = leadStore.captureLead(req.body || {});
    if (result.status === 'SUCCESS' && !result.duplicate) {
      analytics.track('lead_captured', { source: (req.body && req.body.source) || 'api', campaignId: (req.body && req.body.campaign) || null, meta: { productInterest: (req.body && req.body.productInterest) || null } });
    }
    res.status(result.status === 'FAILED' ? 400 : 200).json(result);
  } catch (e) { res.status(500).json({ status: 'FAILED', error: e.message }); }
});

app.post('/events', (req, res) => {
  try {
    const result = analytics.track((req.body && req.body.event) || '', req.body || {});
    res.status(result.status === 'FAILED' ? 400 : 200).json(result);
  } catch (e) { res.status(500).json({ status: 'FAILED', error: e.message }); }
});

app.post('/trigger', async (req, res) => {
  if (!requireTrigger(req, res)) return;
  try {
    const results = await masterLoop();
    global.lastRun = new Date().toISOString();
    res.json({ success: true, results });
  } catch (e) {
    logger.failed('api.trigger', { error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

try { app.use(require('./webhooks/shopify')); } catch (e) { logger.warn('boot.webhooks.shopify', 'FAILED', { error: e.message }); }

if (process.env.ENABLE_INTERNAL_CRON === 'true') {
  cron.schedule('0 0,3,7,10,14,17,21 * * *', async () => {
    try { await masterLoop(); global.lastRun = new Date().toISOString(); }
    catch (e) { logger.failed('cron.fallback', { error: e.message }); }
  });
}

app.listen(PORT, () => { logger.info('server.listen', 'SUCCESS', { port: Number(PORT), env: NODE_ENV }); });
module.exports = app;
