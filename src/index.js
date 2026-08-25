/**
 * CEO-DIOS EMPIRE V20 — Entry Point
 * Express API + optional cron fallback (disabled by default).
 * PRIMARY scheduler: GitHub Actions.
 */
'use strict';

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { masterLoop } = require('./master-loop');
const revenueLedger = require('../lib/revenueLedger');
const productEngine = require('../lib/productEngine');
const shopify = require('../lib/shopifyManager');
const logger = require('../lib/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const TRIGGER_SECRET = process.env.TRIGGER_SECRET || '';

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    name: 'CEO-Dios Empire V20',
    status: 'operational',
    version: '20.0.0',
    mode: 'REVENUE_ENGINE',
    uptime: process.uptime(),
    lastRun: global.lastRun || null,
    shopify_configured: shopify.isConfigured(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '20.0.0',
    uptime_s: process.uptime(),
    shopify_configured: shopify.isConfigured(),
    openai_configured: !!process.env.OPENAI_API_KEY,
    trigger_protected: !!TRIGGER_SECRET,
    internal_cron: process.env.ENABLE_INTERNAL_CRON === 'true',
    timestamp: new Date().toISOString(),
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'alive',
    version: '20.0.0',
    modules: {
      heygen: !!process.env.HEYGEN_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      youtube: !!process.env.YOUTUBE_REFRESH_TOKEN,
      facebook: !!process.env.FACEBOOK_PAGE_TOKEN,
      trading: !!process.env.ALPACA_API_KEY,
      shopify: shopify.isConfigured(),
      hubspot: !!process.env.HUBSPOT_API_KEY,
    },
    lastRun: global.lastRun || 'never',
    revenue: revenueLedger.snapshot(),
  });
});

app.get('/metrics/revenue', (req, res) => {
  res.json(revenueLedger.snapshot());
});

app.get('/catalog/architecture', (req, res) => {
  res.json(productEngine.catalogArchitecture());
});

app.post('/products', async (req, res) => {
  const provided =
    req.get('X-Trigger-Secret') ||
    req.get('x-trigger-secret') ||
    (req.body && req.body.secret) ||
    '';
  if (!TRIGGER_SECRET) {
    return res.status(403).json({ success: false, error: 'Endpoint disabled until TRIGGER_SECRET is set' });
  }
  if (provided !== TRIGGER_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const input = Object.assign({}, req.body || {});
    if (input.dryRun !== false) input.dryRun = true;
    if (input.dryRun === false && !shopify.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Shopify not configured — cannot perform real write',
        status: 'BLOCKED',
      });
    }
    const result = await productEngine.createProduct(input);
    res.status(result.status === 'FAILED' ? 500 : 200).json(Object.assign({ success: result.status !== 'FAILED' }, result));
  } catch (e) {
    logger.failed('api.products', { error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/trigger', async (req, res) => {
  const provided =
    req.get('X-Trigger-Secret') ||
    req.get('x-trigger-secret') ||
    (req.body && req.body.secret) ||
    req.query.secret ||
    '';

  if (!TRIGGER_SECRET) {
    return res.status(403).json({
      success: false,
      error: 'Trigger endpoint is disabled until TRIGGER_SECRET is set in environment',
    });
  }
  if (provided !== TRIGGER_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const results = await masterLoop();
    global.lastRun = new Date().toISOString();
    res.json({ success: true, results });
  } catch (e) {
    logger.failed('api.trigger', { error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

try {
  app.use(require('./webhooks/shopify'));
} catch (e) {
  logger.warn('boot.webhooks.shopify', 'FAILED', { error: e.message });
}

if (process.env.ENABLE_INTERNAL_CRON === 'true') {
  cron.schedule('0 0,3,7,10,14,17,21 * * *', async () => {
    try {
      await masterLoop();
      global.lastRun = new Date().toISOString();
    } catch (e) {
      logger.failed('cron.fallback', { error: e.message });
    }
  });
}

app.listen(PORT, () => {
  logger.info('server.listen', 'SUCCESS', { port: Number(PORT) });
});

module.exports = app;
