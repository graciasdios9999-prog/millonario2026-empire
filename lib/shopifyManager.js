/**
 * Shopify Manager — Admin API with retries, timeouts, structured errors.
 */
'use strict';

const axios = require('axios');
const logger = require('./logger');

let CREDENTIALS;
try {
  CREDENTIALS = require('./config');
} catch (e) {
  CREDENTIALS = {};
}

const SHOP1 = CREDENTIALS.SHOPIFY_SHOP_1 || process.env.SHOPIFY_SHOP_1 || '';
const TOKEN1 = CREDENTIALS.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || '';
const API_VERSION = CREDENTIALS.SHOPIFY_API_VERSION || process.env.SHOPIFY_API_VERSION || '2025-01';
const TIMEOUT_MS = Number(process.env.SHOPIFY_TIMEOUT_MS || 15000);
const MAX_RETRIES = Number(process.env.SHOPIFY_MAX_RETRIES || 3);

function isConfigured() {
  return !!(SHOP1 && TOKEN1);
}

function assertConfigured() {
  if (!isConfigured()) {
    const err = new Error('Shopify not configured. Set SHOPIFY_SHOP_1 and SHOPIFY_ACCESS_TOKEN.');
    err.code = 'SHOPIFY_NOT_CONFIGURED';
    throw err;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(error) {
  const status = error.response && error.response.status;
  if (status === 429 || status === 503 || status === 502 || status === 504) return true;
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') return true;
  return false;
}

async function shopifyRequest(shop, endpoint, method, data) {
  method = method || 'GET';
  assertConfigured();
  const url = 'https://' + shop + '/admin/api/' + API_VERSION + endpoint;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const config = {
        method,
        url,
        timeout: TIMEOUT_MS,
        headers: {
          'X-Shopify-Access-Token': TOKEN1,
          'Content-Type': 'application/json',
        },
      };
      if (data) config.data = data;
      const response = await axios(config);
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response && error.response.status;
      logger.warn('shopify.request', 'RETRYING', {
        endpoint,
        method,
        attempt,
        status: status || null,
        code: error.code || null,
        message: error.message,
      });
      if (!isRetryable(error) || attempt === MAX_RETRIES) break;
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      const retryAfter = error.response && error.response.headers && error.response.headers['retry-after'];
      await sleep(retryAfter ? Number(retryAfter) * 1000 : backoff);
    }
  }
  const err = new Error(
    (lastError.response && lastError.response.data && JSON.stringify(lastError.response.data)) ||
      lastError.message ||
      'Shopify request failed'
  );
  err.code = 'SHOPIFY_REQUEST_FAILED';
  err.status = lastError.response && lastError.response.status;
  throw err;
}

async function createProduct(productData) {
  const result = await shopifyRequest(SHOP1, '/products.json', 'POST', { product: productData });
  return result.product || result;
}

async function getOrders(limit, status) {
  limit = limit || 10;
  status = status || 'any';
  const result = await shopifyRequest(SHOP1, '/orders.json?limit=' + limit + '&status=' + status);
  return result.orders || [];
}

async function updateInventory(inventoryItemId, newQuantity) {
  return shopifyRequest(SHOP1, '/inventory_levels/set.json', 'POST', {
    location_id: process.env.SHOPIFY_LOCATION_ID || 1,
    inventory_item_id: inventoryItemId,
    available: newQuantity,
  });
}

async function syncStores() {
  const products1 = await shopifyRequest(SHOP1, '/products.json?limit=50');
  return {
    synced: (products1.products && products1.products.length) || 0,
    note: 'Write to SHOP2 not implemented',
  };
}

async function processOrder(orderId, action) {
  action = action || 'fulfill';
  if (action === 'fulfill') {
    return shopifyRequest(SHOP1, '/orders/' + orderId + '/fulfillments.json', 'POST', {
      fulfillment: {
        location_id: process.env.SHOPIFY_LOCATION_ID || 1,
        tracking_number: 'AUTO-' + Date.now(),
      },
    });
  }
  return { status: 'processed' };
}

async function createDiscount(code, percentage) {
  const result = await shopifyRequest(SHOP1, '/price_rules.json', 'POST', {
    price_rule: {
      title: code,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'percentage',
      value: -Math.abs(percentage),
      customer_selection: 'all',
      starts_at: new Date().toISOString(),
    },
  });
  return result.price_rule;
}

async function autoCreateRevenueProduct(topic) {
  return createProduct({
    title: 'Auto Bundle: ' + topic,
    body_html: '<p>Auto product for ' + topic + '</p>',
    vendor: 'MiDeli Reset Lab',
    product_type: 'Bundle',
    variants: [{ price: '29.99', sku: 'AUTO-' + Date.now(), inventory_quantity: 100 }],
  });
}

async function findProductByHandle(handle) {
  const result = await shopifyRequest(
    SHOP1,
    '/products.json?handle=' + encodeURIComponent(handle) + '&limit=1',
    'GET'
  );
  const products = (result && result.products) || [];
  return products[0] || null;
}

async function listProducts(limit) {
  limit = limit || 50;
  const result = await shopifyRequest(SHOP1, '/products.json?limit=' + limit, 'GET');
  return (result && result.products) || [];
}

async function getShop() {
  return shopifyRequest(SHOP1, '/shop.json', 'GET');
}

async function healthCheck() {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    await getShop();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message, status: e.status || null };
  }
}

module.exports = {
  createProduct,
  getOrders,
  updateInventory,
  syncStores,
  processOrder,
  createDiscount,
  autoCreateRevenueProduct,
  findProductByHandle,
  listProducts,
  getShop,
  healthCheck,
  isConfigured,
};
