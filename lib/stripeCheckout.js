/**
 * Stripe Checkout — server-side prices only, webhook → VERIFIED / REFUNDED.
 */
'use strict';

const logger = require('./logger');
const revenueLedger = require('./revenueLedger');
const analytics = require('./analytics');

const CATALOG = {
  'midlife-bundle': { priceId: 'price_1U7nVx8Tv6VuYGZuQYybBkVb', productId: 'prod_V83dMit91mKkGS', name: 'Bundle Midlife Reset Completo', amount: 14700, mode: 'payment', tier: 'BUNDLE', offer_id: 'offer_bundle_147' },
  'latiz-21': { priceId: 'price_1U7nVk8Tv6VuYGZumOEoUnci', productId: 'prod_V83cNF9EnuNvpT', name: 'Protocolo Látiz Avanzado 21 Días', amount: 6700, mode: 'payment', tier: 'CORE', offer_id: 'offer_latiz_67' },
  'essential-membership': { priceId: 'price_1U2Nvp8Tv6VuYGZu1jEAs4zC', productId: 'prod_V2SrASu96o2fkK', name: 'Membresía Essential Midlife Reset', amount: 2900, mode: 'subscription', tier: 'ENTRY', offer_id: 'offer_essential_29' },
  'curso-30': { priceId: 'price_1U2Nvf8Tv6VuYGZujfuE7S0d', productId: 'prod_V2Sr9Zcf7GNRx0', name: 'Curso Inicial 30 Días Midlife Reset', amount: 9700, mode: 'payment', tier: 'CORE', offer_id: 'offer_curso_97' },
  'guia-premium': { priceId: 'price_1U2NvW8Tv6VuYGZuVP3Hq7HQ', productId: 'prod_V2SrQj7tUwv7Or', name: 'Guía Premium Midlife Reset', amount: 4700, mode: 'payment', tier: 'ENTRY', offer_id: 'offer_guia_47' },
};

const PRICE_ID_INDEX = {};
for (const [key, v] of Object.entries(CATALOG)) PRICE_ID_INDEX[v.priceId] = Object.assign({ key }, v);

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
    key, name: v.name, priceId: v.priceId, amount_usd: v.amount / 100, mode: v.mode, tier: v.tier, offer_id: v.offer_id,
  }));
}

function resolveCatalogEntry(input) {
  input = input || {};
  if (input.amount != null || input.unit_amount != null || input.price != null) {
    return { error: 'client_price_rejected', message: 'Server determines price. Pass priceKey only.' };
  }
  if (input.priceKey && CATALOG[input.priceKey]) return { entry: Object.assign({ key: input.priceKey }, CATALOG[input.priceKey]) };
  if (input.priceId && PRICE_ID_INDEX[input.priceId]) return { entry: PRICE_ID_INDEX[input.priceId] };
  if (input.priceId && !PRICE_ID_INDEX[input.priceId]) return { error: 'unknown_price_id', message: 'priceId not in server catalog' };
  return { error: 'priceKey_or_priceId_required', message: 'Pass a valid priceKey from /stripe/catalog' };
}

async function createCheckoutSession(input) {
  input = input || {};
  const started = Date.now();
  const resolved = resolveCatalogEntry(input);
  if (resolved.error) {
    logger.warn('stripe.createCheckoutSession', 'FAILED', { error: resolved.error });
    return { status: 'FAILED', error: resolved.error, message: resolved.message };
  }
  const entry = resolved.entry;
  const baseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_URL || 'http://localhost:3000';
  const successUrl = input.successUrl || process.env.STRIPE_SUCCESS_URL || baseUrl + '/checkout/success?session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = input.cancelUrl || process.env.STRIPE_CANCEL_URL || baseUrl + '/checkout/cancel';
  const quantity = Math.max(1, Math.min(10, Number(input.quantity) || 1));
  const mode = entry.mode || 'payment';
  const attribution = {
    utm_source: (input.metadata && input.metadata.utm_source) || input.source || '',
    utm_medium: (input.metadata && input.metadata.utm_medium) || '',
    utm_campaign: (input.metadata && input.metadata.utm_campaign) || input.campaignId || '',
    utm_content: (input.metadata && input.metadata.utm_content) || '',
    utm_term: (input.metadata && input.metadata.utm_term) || '',
  };

  if (input.dryRun === true || !isConfigured()) {
    logger.blocked('stripe.createCheckoutSession', {
      reason: isConfigured() ? 'dry_run' : 'stripe_not_configured',
      priceId: entry.priceId, priceKey: entry.key, mode, duration_ms: Date.now() - started,
    });
    return {
      status: 'BLOCKED',
      reason: isConfigured() ? 'dry_run' : 'stripe_not_configured',
      preview: {
        mode, priceKey: entry.key, priceId: entry.priceId, quantity, successUrl, cancelUrl,
        amount_usd: (entry.amount * quantity) / 100, name: entry.name, offer_id: entry.offer_id, attribution,
      },
    };
  }

  try {
    const stripe = getStripe();
    const idempotencyKey = (input.idempotencyKey || ['cs', entry.key, input.customerEmail || '', input.sessionId || '', Math.floor(Date.now() / 60000)].join('_')).slice(0, 255);
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: entry.priceId, quantity }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: input.customerEmail || undefined,
      allow_promotion_codes: true,
      client_reference_id: input.sessionId || undefined,
      metadata: {
        price_key: entry.key, offer_id: entry.offer_id || '', product_id: entry.productId || '',
        tier: entry.tier || '', source: 'empire_api', session_id: input.sessionId || '',
        lead_email_domain: input.customerEmail ? String(input.customerEmail).split('@')[1] || '' : '',
        utm_source: attribution.utm_source, utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign, utm_content: attribution.utm_content, utm_term: attribution.utm_term,
      },
    }, { idempotencyKey });

    logger.success('stripe.createCheckoutSession', { session_id: session.id, price_key: entry.key, mode, duration_ms: Date.now() - started });
    return { status: 'SUCCESS', sessionId: session.id, url: session.url, mode, priceKey: entry.key, amount_total: session.amount_total, currency: session.currency };
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
    const meta = session.metadata || {};
    const result = revenueLedger.ingestShopifyOrder({
      id: orderId, order_id: orderId, total_price: amountTotal, currency, financial_status: 'paid',
      created_at: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
      source: 'stripe_checkout', product_key: meta.price_key || null, product_id: meta.product_id || null,
      offer_id: meta.offer_id || null,
      customer_email: (session.customer_details && session.customer_details.email) || session.customer_email || null,
      session_id: meta.session_id || session.client_reference_id || null,
      attribution: {
        utm_source: meta.utm_source || null, utm_medium: meta.utm_medium || null,
        utm_campaign: meta.utm_campaign || null, utm_content: meta.utm_content || null, utm_term: meta.utm_term || null,
      },
    });
    analytics.track('purchase', {
      orderId, amount: amountTotal, source: meta.utm_source || 'stripe_checkout',
      campaignId: meta.utm_campaign || null, productId: meta.price_key || null, idempotencyKey: 'stripe_cs_' + orderId,
    });
    logger.verified('stripe.checkout.session.completed', {
      session_id: orderId, amount: amountTotal, currency, product_key: meta.price_key, duplicate: !!(result && result.duplicate),
    });
    return { status: 'SUCCESS', revenue_type: 'VERIFIED', result };
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data && event.data.object;
    logger.info('stripe.checkout.expired', 'SUCCESS', { session_id: session && session.id });
    return { status: 'SUCCESS', type: 'expired' };
  }

  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const obj = event.data && event.data.object;
    if (!obj) return { status: 'FAILED', error: 'missing_object' };
    const amount = event.type === 'charge.refunded'
      ? Number(obj.amount_refunded || obj.amount || 0) / 100
      : Number(obj.amount || 0) / 100;
    const result = revenueLedger.ingestRefund({
      id: obj.id + (event.type === 'charge.dispute.created' ? '_dispute' : '_refund'),
      order_id: obj.payment_intent || null, amount, currency: obj.currency, reason: event.type, source: 'stripe',
    });
    analytics.track('refund', {
      orderId: obj.payment_intent || obj.id, amount, source: 'stripe',
      idempotencyKey: 'ref_' + obj.id + '_' + event.type,
    });
    return { status: 'SUCCESS', revenue_type: 'REFUNDED', result };
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data && event.data.object;
    logger.warn('stripe.payment_failed', 'FAILED', { payment_intent: pi && pi.id });
    return { status: 'SUCCESS', type: 'payment_failed' };
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
  return getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = {
  CATALOG, listCatalog, isConfigured, resolveCatalogEntry, createCheckoutSession, handleWebhookEvent, constructEvent,
};
