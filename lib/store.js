/**
 * Durable JSON store — products, verified orders, refunds, attribution.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'empire_store.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
}

function load() {
  ensureDir();
  try {
    if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    logger.warn('store.load', 'FAILED', { error: e.message });
  }
  return { products: {}, idempotency: {}, orders_verified: {}, refunds: {}, revenue_events: [], metrics: {} };
}

function save(state) {
  ensureDir();
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

function getProductByKey(idempotencyKey) {
  return load().products[idempotencyKey] || null;
}

function saveProduct(idempotencyKey, productRecord) {
  const state = load();
  state.products[idempotencyKey] = Object.assign({}, productRecord, { updated_at: new Date().toISOString() });
  state.idempotency[idempotencyKey] = {
    entity: 'product',
    entity_id: productRecord.shopify_product_id || productRecord.id,
    at: new Date().toISOString(),
  };
  save(state);
  return state.products[idempotencyKey];
}

function listProducts() {
  return Object.values(load().products);
}

function recordVerifiedOrder(order) {
  const state = load();
  const id = String(order.id || order.order_id);
  if (!id || id === 'undefined') return { duplicate: false, error: 'missing_id' };
  if (state.orders_verified[id]) return { duplicate: true, order: state.orders_verified[id] };
  const record = {
    id,
    total_price: Number(order.total_price || 0),
    currency: (order.currency || 'USD').toUpperCase(),
    financial_status: order.financial_status || 'paid',
    created_at: order.created_at || new Date().toISOString(),
    recorded_at: new Date().toISOString(),
    source: order.source || 'payment_webhook',
    revenue_type: 'VERIFIED',
    product_key: order.product_key || order.price_key || null,
    product_id: order.product_id || null,
    offer_id: order.offer_id || null,
    price_id: order.price_id || null,
    customer_email: order.customer_email || null,
    attribution: order.attribution || {},
    session_id: order.session_id || null,
    lead_id: order.lead_id || null,
  };
  state.orders_verified[id] = record;
  state.revenue_events = state.revenue_events || [];
  state.revenue_events.push({
    type: 'ORDER_VERIFIED', order_id: id, amount: record.total_price, currency: record.currency,
    product_key: record.product_key, at: record.recorded_at,
  });
  save(state);
  return { duplicate: false, order: record };
}

function recordRefund(refund) {
  const state = load();
  const id = String(refund.id || refund.refund_id || refund.charge_id || '');
  if (!id) return { status: 'FAILED', error: 'missing_refund_id' };
  if (state.refunds && state.refunds[id]) return { status: 'SUCCESS', duplicate: true, refund: state.refunds[id] };
  state.refunds = state.refunds || {};
  const record = {
    id,
    order_id: refund.order_id || refund.payment_intent || null,
    amount: Number(refund.amount || 0),
    currency: (refund.currency || 'USD').toUpperCase(),
    reason: refund.reason || null,
    recorded_at: new Date().toISOString(),
    source: refund.source || 'stripe',
    revenue_type: 'REFUNDED',
  };
  state.refunds[id] = record;
  state.revenue_events = state.revenue_events || [];
  state.revenue_events.push({
    type: 'REFUND', refund_id: id, order_id: record.order_id, amount: record.amount,
    currency: record.currency, at: record.recorded_at,
  });
  if (record.order_id && state.orders_verified[record.order_id]) {
    state.orders_verified[record.order_id].financial_status = 'refunded';
    state.orders_verified[record.order_id].refunded_amount =
      (state.orders_verified[record.order_id].refunded_amount || 0) + record.amount;
  }
  save(state);
  return { status: 'SUCCESS', duplicate: false, refund: record };
}

function getVerifiedRevenueSummary() {
  const state = load();
  const orders = Object.values(state.orders_verified || {});
  const refunds = Object.values(state.refunds || {});
  const gross = orders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
  const refunded = refunds.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const net = Math.max(0, gross - refunded);
  const count = orders.length;
  const byProduct = {};
  const bySource = {};
  const byCampaign = {};
  for (const o of orders) {
    const pk = o.product_key || 'unknown';
    byProduct[pk] = (byProduct[pk] || 0) + (Number(o.total_price) || 0);
    const src = (o.attribution && o.attribution.utm_source) || o.source || 'unknown';
    bySource[src] = (bySource[src] || 0) + (Number(o.total_price) || 0);
    const camp = (o.attribution && o.attribution.utm_campaign) || null;
    if (camp) byCampaign[camp] = (byCampaign[camp] || 0) + (Number(o.total_price) || 0);
  }
  return {
    REVENUE_VERIFIED: Math.round(gross * 100) / 100,
    REVENUE_REFUNDED: Math.round(refunded * 100) / 100,
    NET_REVENUE: Math.round(net * 100) / 100,
    ORDERS_VERIFIED: count,
    REFUNDS_COUNT: refunds.length,
    AOV_VERIFIED: count ? Math.round((gross / count) * 100) / 100 : 0,
    by_product: byProduct,
    by_source: bySource,
    by_campaign: byCampaign,
  };
}

module.exports = {
  getProductByKey, saveProduct, listProducts, recordVerifiedOrder, recordRefund, getVerifiedRevenueSummary, load,
};
