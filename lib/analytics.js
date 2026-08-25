/**
 * Analytics — observed events + funnel rates. Never invents conversions.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../data');
const EVENTS_PATH = path.join(DATA_DIR, 'events.json');

const ALLOWED = new Set([
  'page_view', 'product_view', 'add_to_cart', 'checkout_started',
  'purchase', 'upsell', 'cross_sell', 'refund', 'lead_captured',
]);

function ensure() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
}

function loadEvents() {
  ensure();
  try {
    if (fs.existsSync(EVENTS_PATH)) return JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  } catch (e) {
    logger.warn('analytics.load', 'FAILED', { error: e.message });
  }
  return { events: [], seen_ids: {} };
}

function saveEvents(state) {
  ensure();
  const tmp = EVENTS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, EVENTS_PATH);
}

function track(eventName, payload) {
  if (!ALLOWED.has(eventName)) {
    logger.warn('analytics.track', 'FAILED', { error: 'invalid_event', eventName });
    return { status: 'FAILED', error: 'invalid_event' };
  }
  const state = loadEvents();
  const idempotencyKey = (payload && (payload.idempotencyKey || payload.event_id)) || null;
  if (idempotencyKey && state.seen_ids && state.seen_ids[idempotencyKey]) {
    return { status: 'SUCCESS', duplicate: true, event_id: state.seen_ids[idempotencyKey] };
  }
  const entry = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    event: eventName,
    ts: new Date().toISOString(),
    sessionId: (payload && payload.sessionId) || null,
    customerId: (payload && payload.customerId) || null,
    productId: (payload && payload.productId) || null,
    orderId: (payload && payload.orderId) || null,
    campaignId: (payload && payload.campaignId) || null,
    source: (payload && payload.source) || 'app',
    amount: payload && payload.amount != null ? Number(payload.amount) : null,
    meta: (payload && payload.meta) || {},
  };
  state.events = state.events || [];
  state.seen_ids = state.seen_ids || {};
  state.events.push(entry);
  if (idempotencyKey) state.seen_ids[idempotencyKey] = entry.id;
  if (state.events.length > 5000) state.events = state.events.slice(-4000);
  saveEvents(state);
  logger.info('analytics.track', 'SUCCESS', { event: eventName, id: entry.id });
  return { status: 'SUCCESS', event: entry, duplicate: false };
}

function rate(num, den) {
  if (!den) return null;
  return Math.round((num / den) * 10000) / 100;
}

function summary() {
  const events = loadEvents().events || [];
  const counts = {};
  for (const e of events) counts[e.event] = (counts[e.event] || 0) + 1;
  const pageViews = counts.page_view || 0;
  const productViews = counts.product_view || 0;
  const leads = counts.lead_captured || 0;
  const carts = counts.add_to_cart || 0;
  const checkouts = counts.checkout_started || 0;
  const purchases = counts.purchase || 0;
  const purchaseEvents = events.filter((e) => e.event === 'purchase');
  const observedPurchaseAmount = purchaseEvents.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const bySource = {};
  const byCampaign = {};
  for (const e of events) {
    if (e.source) bySource[e.source] = (bySource[e.source] || 0) + 1;
    if (e.campaignId) byCampaign[e.campaignId] = (byCampaign[e.campaignId] || 0) + 1;
  }
  return {
    total_events: events.length,
    counts,
    funnel: {
      page_view: pageViews, product_view: productViews, lead_captured: leads,
      add_to_cart: carts, checkout_started: checkouts, purchase: purchases,
    },
    rates_observed: {
      product_view_rate: rate(productViews, pageViews),
      lead_conversion_rate: rate(leads, pageViews),
      cart_conversion_rate: rate(carts, productViews),
      checkout_conversion_rate: rate(checkouts, carts),
      purchase_conversion_rate: rate(purchases, checkouts),
      overall_purchase_rate: rate(purchases, pageViews),
      note: 'Rates from observed app events only — not Shopify storefront analytics.',
    },
    observed_purchase_events: purchaseEvents.length,
    observed_purchase_amount: observedPurchaseAmount,
    by_source: bySource,
    by_campaign: byCampaign,
    note: 'Observed app events only. Not Shopify VERIFIED revenue unless linked to order ledger.',
  };
}

module.exports = { track, summary, ALLOWED };
