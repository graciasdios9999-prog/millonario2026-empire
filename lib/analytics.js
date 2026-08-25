/**
 * Analytics event store — observed events only, never invents conversions.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../data');
const EVENTS_PATH = path.join(DATA_DIR, 'events.json');

const ALLOWED = new Set([
  'page_view',
  'product_view',
  'add_to_cart',
  'checkout_started',
  'purchase',
  'upsell',
  'cross_sell',
  'refund',
  'lead_captured',
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
  return { events: [] };
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
  const entry = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    event: eventName,
    ts: new Date().toISOString(),
    sessionId: (payload && payload.sessionId) || null,
    customerId: (payload && payload.customerId) || null,
    productId: (payload && payload.productId) || null,
    orderId: (payload && payload.orderId) || null,
    amount: payload && payload.amount != null ? Number(payload.amount) : null,
    source: (payload && payload.source) || 'app',
    meta: (payload && payload.meta) || {},
  };
  state.events.push(entry);
  if (state.events.length > 5000) state.events = state.events.slice(-4000);
  saveEvents(state);
  logger.info('analytics.track', 'SUCCESS', { event: eventName, id: entry.id });
  return { status: 'SUCCESS', event: entry };
}

function summary() {
  const events = loadEvents().events || [];
  const counts = {};
  for (const e of events) counts[e.event] = (counts[e.event] || 0) + 1;
  const purchases = events.filter((e) => e.event === 'purchase');
  const observedPurchaseAmount = purchases.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return {
    total_events: events.length,
    counts,
    observed_purchase_events: purchases.length,
    observed_purchase_amount: observedPurchaseAmount,
    note: 'Observed app events only. Not Shopify VERIFIED revenue unless linked to order ledger.',
  };
}

module.exports = { track, summary, ALLOWED };
