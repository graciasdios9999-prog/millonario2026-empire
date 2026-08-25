/**
 * Stripe webhook — raw body + signature → VERIFIED ledger.
 */
'use strict';

const express = require('express');
const logger = require('../../lib/logger');
const stripeCheckout = require('../../lib/stripeCheckout');

const router = express.Router();

router.post('/webhook-stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const raw = req.body;
  let event;
  try {
    event = stripeCheckout.constructEvent(raw, sig);
  } catch (e) {
    logger.failed('stripe.webhook.verify', { error: e.message });
    return res.status(400).send('Webhook Error: ' + e.message);
  }
  try {
    const result = stripeCheckout.handleWebhookEvent(event);
    res.json({ received: true, result });
  } catch (e) {
    logger.failed('stripe.webhook.handle', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
