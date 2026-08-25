/**
 * Funnel event analytics — never fabricates conversions.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../data');
const EVENTS_PATH = path.join(DATA_DIR, 'events.jsonl');

const ALLOWED = new Set([
  'page_view', 'product_view', 'add_to_cart', 'checkout_started',
  'purchase', 'upsell', 'cross_sell', 'refund', 'lead_captured',
]);

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
}

function track(event, payload) {
  if (!ALLOWED.has(event)) return { status: 'FAILED', error: 'invalid_event' };
  const entry = {
    ts: new Date().toISOString(),
    event,
    session_id: payload && payload.session_id,
    customer_id: payload && payload.customer_id,
    product_id: payload && payload.product_id,
    order_id: payload && payload.order_id,
    value: payload && payload.value != null ? Number(payload.value) : undefined,
    currency: (payload && payload.currency) || 'USD',
    source: (payload && payload.source) || 'internal',
  };
  ensureDir();
  try {
    fs.appendFileSync(EVENTS_PATH, JSON.stringify(entry) + '\n');
  } catch (e) {
    logger.failed('analytics.track', { error: e.message });
    return { status: 'FAILED', error: e.message };
  }
  logger.info('analytics.track', 'SUCCESS', { event: entry.event, order_id: entry.order_id });
  return { status: 'SUCCESS', entry };
}

function summarize(limit) {
  limit = limit || 500;
  ensureDir();
  if (!fs.existsSync(EVENTS_PATH)) {
    return { events: 0, by_type: {}, note: 'no events recorded' };
  }
  const lines = fs.readFileSync(EVENTS_PATH, 'utf8').trim().split('\n').filter(Boolean).slice(-limit);
  const by_type = {};
  let purchases = 0;
  let revenue_observed = 0;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      by_type[e.event] = (by_type[e.event] || 0) + 1;
      if (e.event === 'purchase') {
        purchases += 1;
        revenue_observed += Number(e.value || 0);
      }
    } catch (_) {}
  }
  return {
    events: lines.length,
    by_type,
    purchases_observed: purchases,
    revenue_observed_from_events: revenue_observed,
    note: 'OBSERVED local telemetry — not Shopify VERIFIED unless order ingested in ledger',
  };
}

module.exports = { track, summarize, ALLOWED };
