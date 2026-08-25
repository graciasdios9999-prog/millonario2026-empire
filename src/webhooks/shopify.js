/**
 * Shopify Webhook Handler — HMAC + order → VERIFIED ledger (idempotent).
 */
'use strict';

const express = require('express');
const crypto = require('crypto');
const logger = require('../../lib/logger');
const revenueLedger = require('../../lib/revenueLedger');
const analytics = require('../../lib/analytics');

const router = express.Router();

function verifyShopifyWebhook(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  if (!hmacHeader) return false;
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
  } catch (_) {
    return false;
  }
}

router.post(
  '/webhook-shopify/:topic',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');

    if (!verifyShopifyWebhook(raw, hmac)) {
      logger.failed('shopify.webhook', { error: 'invalid_signature' });
      return res.sendStatus(401);
    }

    let data;
    try {
      data = JSON.parse(raw || '{}');
    } catch (e) {
      return res.sendStatus(400);
    }

    const topic = String(req.params.topic || '').replace(/_/g, '/');
    logger.info('shopify.webhook', 'SUCCESS', { topic });

    if (
      topic === 'orders/create' ||
      topic === 'orders/updated' ||
      topic === 'orders-create' ||
      topic === 'orders-updated'
    ) {
      try {
        const result = revenueLedger.ingestShopifyOrder(data);
        if (result && result.status === 'SUCCESS' && !result.duplicate) {
          analytics.track('purchase', {
            orderId: String(data.id || data.order_id || ''),
            amount: Number(data.total_price || 0),
            source: 'shopify_webhook',
          });
        }
      } catch (e) {
        logger.failed('shopify.webhook.order', { error: e.message });
      }
    }

    res.sendStatus(200);
  }
);

module.exports = router;
