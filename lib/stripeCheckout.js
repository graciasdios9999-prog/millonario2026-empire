/**
 * Stripe Checkout — sessions + webhook fulfillment → VERIFIED revenue.
 * Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (never logged).
 */
'use strict';

const logger = require('./logger');
const revenueLedger = require('./revenueLedger');
const analytics = require('./analytics');

const CATALOG = {
  'midlife-bundle': {
    priceId: 'price_1U7nVx8Tv6VuYGZuQYybBkVb',
    productId: 'prod_V83dMit91mKkGS',
    name: 'Bundle Midlife Reset Completo',
    amount: 14700,
    mode: 'payment',
    tier: 'BUNDLE',
  },
  'latiz-21': {
    priceId: 'price_1U7nVk8Tv6VuYGZumOEoUnci',
    productId: 'prod_V83cNF9EnuNvpT',
    name: 'Protocolo Látiz Avanzado 21 Días',
    amount: 6700,
    mode: 'payment',
    tier: 'CORE',
  },
  'essential-membership': {
    priceId: 'price_1U2Nvp8Tv6VuYGZu1jEAs4zC',
    productId: 'prod_V2SrASu96o2fkK',
    name: 'Membresía Essential Midlife Reset',
    amount: 2900,
    mode: 'subscription',
    tier: 'ENTRY',
  },
  'curso-30': {
    priceId: 'price_1U2Nvf8Tv6VuYGZujfuE7S0d',
    productId: 'prod_V2Sr9Zcf7GNRx0',
    name: 'Curso Inicial 30 Días Midlife Reset',
    amount: 9700,
    mode: 'payment',
    tier: 'CORE',
  },
  'guia-premium': {
    priceId: 'price_1U2NvW8Tv6VuYGZuVP3Hq7HQ',
    productId: 'prod_V2SrQj7tUwv7Or',
    name: 'Guía Premium Midlife Reset',
    amount: 4700,
    mode: 'payment',
    tier: 'ENTRY',
  },
};

function isConfigured() {
  return !!(process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).startsWith('sk_'));
}

function getStripe() {
  if (!isConfigured()) {
    const err = new Error('Stripe not configured. Set STRIPE_SECRET_KEY.');
    err.code = 'STRIPE_NOT_CONFIGURED';
    throw err;
  }
  const Stripe = require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
}

function listCatalog() {
  return Object.entries(CATALOG).map(([key, v]) => ({
    key,
    name: v.name,
    priceId: v.priceId,
    amount_usd: v.amount / 100,
    mode: v.mode,
    tier: v.tier,
  }));
}

async function createCheckoutSession(input) {
  input = input || {};
  const started = Date.now();
  let entry = null;
  if (input.priceKey && CATALOG[input.priceKey]) entry = CATALOG[input.priceKey];
  else if (input.priceId) {
    entry = Object.values(CATALOG).find((c) => c.priceId === input.priceId) || {
      priceId: input.priceId,
      mode: input.mode === 'subscription' ? 'subscription' : 'payment',
      name: input.name || 'Custom',
      amount: input.amount || null,
    };
  } else return { status: 'FAILED', error: 'priceKey_or_priceId_required' };

  const baseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_URL || 'http://localhost:3000';
  const successUrl = input.successUrl || process.env.STRIPE_SUCCESS_URL || baseUrl + '/checkout/success?session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = input.cancelUrl || process.env.STRIPE_CANCEL_URL || baseUrl + '/checkout/cancel';
  const quantity = Math.max(1, Number(input.quantity) || 1);
  const mode = entry.mode || 'payment';

  if (input.dryRun === true || !isConfigured()) {
    logger.blocked('stripe.createCheckoutSession', {
      reason: isConfigured() ? 'dry_run' : 'stripe_not_configured',
      priceId: entry.priceId,
      mode,
      duration_ms: Date.now() - started,
    });
    return {
      status: 'BLOCKED',
      reason: isConfigured() ? 'dry_run' : 'stripe_not_configured',
      preview: {
        mode,
        priceId: entry.priceId,
        quantity,
        successUrl,
        cancelUrl,
        amount_usd: entry.amount != null ? (entry.amount * quantity) / 100 : null,
        name: entry.name,
      },
    };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: entry.priceId, quantity }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: input.customerEmail || undefined,
      allow_promotion_codes: true,
      metadata: Object.assign({ price_key: input.priceKey || '', tier: entry.tier || '', source: 'empire_api' }, input.metadata || {}),
    });
    logger.success('stripe.createCheckoutSession', { session_id: session.id, mode, duration_ms: Date.now() - started });
    return { status: 'SUCCESS', sessionId: session.id, url: session.url, mode, amount_total: session.amount_total, currency: session.currency };
  } catch (e) {
    logger.failed('stripe.createCheckoutSession', { error: e.message, duration_ms: Date.now() - started });
    return { status: 'FAILED', error: e.message };
  }
}

function handleWebhookEvent(event) {
  if (!event || !event.type) return { status: 'FAILED', error: 'invalid_event' };
  if (event.type === 'checkout.session.completed') {
    const session = event.data && event.data.object;
    if (!session) return { status: 'FAILED', error: 'missing_session' };
    const orderId = session.id;
    const amountTotal = Number(session.amount_total || 0) / 100;
    const currency = (session.currency || 'usd').toUpperCase();
    const paid = session.payment_status === 'paid' || session.status === 'complete' || session.payment_status === 'no_payment_required';
    if (!paid) {
      logger.warn('stripe.webhook', 'SKIPPED', { reason: 'not_paid', session_id: orderId });
      return { status: 'SKIPPED', reason: 'not_paid' };
    }
    const result = revenueLedger.ingestShopifyOrder({
      id: orderId,
      order_id: orderId,
      total_price: amountTotal,
      currency,
      financial_status: 'paid',
      created_at: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
      source: 'stripe_checkout',
    });
    analytics.track('purchase', {
      orderId,
      amount: amountTotal,
      source: 'stripe_checkout',
      campaignId: (session.metadata && session.metadata.campaign_id) || null,
      idempotencyKey: 'stripe_cs_' + orderId,
    });
    logger.verified('stripe.checkout.session.completed', {
      session_id: orderId,
      amount: amountTotal,
      currency,
      duplicate: !!(result && result.duplicate),
    });
    return { status: 'SUCCESS', revenue_type: 'VERIFIED', result };
  }
  return { status: 'IGNORED', type: event.type };
}

function constructEvent(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('STRIPE_WEBHOOK_SECRET required in production');
      err.code = 'WEBHOOK_SECRET_MISSING';
      throw err;
    }
    return typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { CATALOG, listCatalog, isConfigured, createCheckoutSession, handleWebhookEvent, constructEvent };
