/**
 * Lightweight durable store for product registry + idempotency keys.
 * Uses JSON file under ./data (works without native better-sqlite3).
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
  return { products: {}, idempotency: {}, orders_verified: {}, revenue_events: [], metrics: {} };
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
  state.products[idempotencyKey] = { ...productRecord, updated_at: new Date().toISOString() };
  state.idempotency[idempotencyKey] = {
    entity: 'product',
    entity_id: productRecord.shopify_product_id || productRecord.id,
    at: new Date().toISOString(),
  };
  save(state);
  return state.products[idempotencyKey];
}

function recordVerifiedOrder(order) {
  const state = load();
  const id = String(order.id || order.order_id);
  if (state.orders_verified[id]) return { duplicate: true, order: state.orders_verified[id] };
  const record = {
    id,
    total_price: Number(order.total_price || 0),
    currency: order.currency || 'USD',
    financial_status: order.financial_status || 'unknown',
    created_at: order.created_at || new Date().toISOString(),
    recorded_at: new Date().toISOString(),
    source: 'shopify_webhook_or_api',
    revenue_type: 'VERIFIED',
  };
  state.orders_verified[id] = record;
  state.revenue_events.push({
    type: 'ORDER_VERIFIED', order_id: id, amount: record.total_price, currency: record.currency, at: record.recorded_at,
  });
  save(state);
  return { duplicate: false, order: record };
}

function getVerifiedRevenueSummary() {
  const state = load();
  const orders = Object.values(state.orders_verified);
  const paid = orders.filter((o) =>
    ['paid', 'partially_paid', 'authorized'].includes(String(o.financial_status).toLowerCase())
  );
  const revenue = paid.reduce((s, o) => s + Number(o.total_price || 0), 0);
  return {
    REVENUE_VERIFIED: revenue,
    REVENUE_ESTIMATED: null,
    ORDERS_VERIFIED: paid.length,
    ORDERS_TOTAL_RECORDED: orders.length,
    AOV_VERIFIED: paid.length ? revenue / paid.length : 0,
    currency: (paid[0] && paid[0].currency) || 'USD',
  };
}

function listProducts() {
  return Object.values(load().products);
}

module.exports = {
  load, save, getProductByKey, saveProduct, recordVerifiedOrder, getVerifiedRevenueSummary, listProducts, STORE_PATH,
};
