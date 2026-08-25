/**
 * Shopify webhooks — HMAC, order → VERIFIED revenue, event idempotency.
 */
'use strict';

const express = require('express');
const crypto = require('crypto');
const logger = require('../../lib/logger');
const revenueLedger = require('../../lib/revenueLedger');
const analytics = require('../../lib/analytics');
const store = require('../../lib/store');

const router = express.Router();

function verifyShopifyWebhook(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  if (!hmacHeader) return false;
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try { return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader)); }
  catch (_) { return false; }
}

function eventIdempotencyKey(topic, data) {
  const id = data && (data.id || data.admin_graphql_api_id || data.order_number);
  return String(topic) + ':' + String(id || crypto.createHash('sha256').update(JSON.stringify(data || {})).digest('hex').slice(0, 16));
}

router.post('/webhook-shopify/:topic', express.raw({ type: 'application/json' }), async (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  if (!verifyShopifyWebhook(raw, hmac)) {
    logger.failed('shopify.webhook', { error: 'invalid_signature' });
    return res.sendStatus(401);
  }
  let data;
  try { data = JSON.parse(raw || '{}'); } catch (e) { return res.sendStatus(400); }
  const topic = req.params.topic;
  const key = eventIdempotencyKey(topic, data);
  const state = store.load();
  if (!state.webhook_events) state.webhook_events = {};
  if (state.webhook_events[key]) {
    logger.info('shopify.webhook', 'SUCCESS', { topic, duplicate: true });
    return res.sendStatus(200);
  }
  state.webhook_events[key] = { at: new Date().toISOString(), topic };
  const keys = Object.keys(state.webhook_events);
  if (keys.length > 5000) keys.slice(0, keys.length - 4000).forEach((k) => delete state.webhook_events[k]);
  store.save(state);
  logger.info('shopify.webhook', 'SUCCESS', { topic });
  if (topic === 'orders-create' || topic === 'orders/create' || topic === 'orders-updated' || topic === 'orders/updated') {
    try {
      revenueLedger.ingestShopifyOrder(data);
      analytics.track('purchase', { order_id: data.id, value: data.total_price, currency: data.currency || 'USD', source: 'shopify_webhook' });
    } catch (e) {
      logger.failed('shopify.webhook.order', { error: e.message });
    }
  }
  res.sendStatus(200);
});

module.exports = router;
