/**
 * Shopify Manager — Admin API helpers.
 * Credentials exclusively from process.env / lib/config.
 */
'use strict';

const axios = require('axios');

let CREDENTIALS;
try {
  CREDENTIALS = require('./config');
} catch (e) {
  CREDENTIALS = {};
}

const SHOP1 = CREDENTIALS.SHOPIFY_SHOP_1 || process.env.SHOPIFY_SHOP_1 || '';
const TOKEN1 = CREDENTIALS.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || '';
const API_VERSION = CREDENTIALS.SHOPIFY_API_VERSION || process.env.SHOPIFY_API_VERSION || '2025-01';
const SHOP2 = CREDENTIALS.SHOPIFY_SHOP_2 || process.env.SHOPIFY_SHOP_2 || '';

function assertConfigured() {
  if (!SHOP1 || !TOKEN1) {
    throw new Error('Shopify not configured. Set SHOPIFY_SHOP_1 and SHOPIFY_ACCESS_TOKEN.');
  }
}

async function shopifyRequest(shop, endpoint, method, data) {
  method = method || 'GET';
  assertConfigured();
  const url = 'https://' + shop + '/admin/api/' + API_VERSION + endpoint;
  const config = {
    method,
    url,
    headers: {
      'X-Shopify-Access-Token': TOKEN1,
      'Content-Type': 'application/json',
    },
  };
  if (data) config.data = data;
  const response = await axios(config);
  return response.data;
}

async function createProduct(productData) {
  // REAL WRITE
  const result = await shopifyRequest(SHOP1, '/products.json', 'POST', { product: productData });
  return result.product || result;
}

async function getOrders(limit, status) {
  // REAL READ
  limit = limit || 10;
  status = status || 'any';
  const result = await shopifyRequest(SHOP1, '/orders.json?limit=' + limit + '&status=' + status);
  return result.orders || [];
}

async function updateInventory(inventoryItemId, newQuantity) {
  // REAL WRITE
  return shopifyRequest(SHOP1, '/inventory_levels/set.json', 'POST', {
    location_id: process.env.SHOPIFY_LOCATION_ID || 1,
    inventory_item_id: inventoryItemId,
    available: newQuantity,
  });
}

async function syncStores() {
  // PARTIAL REAL READ
  const products1 = await shopifyRequest(SHOP1, '/products.json?limit=50');
  return {
    synced: (products1.products && products1.products.length) || 0,
    note: 'Write to SHOP2 not implemented',
  };
}

async function processOrder(orderId, action) {
  // REAL WRITE (fulfill)
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
  // REAL WRITE
  const result = await shopifyRequest(SHOP1, '/price_rules.json', 'POST', {
    price_rule: {
      title: code,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'percentage',
      value: -percentage,
      customer_selection: 'all',
      starts_at: new Date().toISOString(),
    },
  });
  return result.price_rule;
}

async function autoCreateRevenueProduct(topic) {
  // REAL WRITE wrapper — prefer productEngine for idempotency
  return createProduct({
    title: 'Auto Bundle: ' + topic,
    body_html: '<p>Auto product for ' + topic + '</p>',
    vendor: 'MiDeli Reset Lab',
    product_type: 'Bundle',
    variants: [{ price: '29.99', sku: 'AUTO-' + Date.now(), inventory_quantity: 100 }],
  });
}

async function findProductByHandle(handle) {
  // REAL READ
  const result = await shopifyRequest(
    SHOP1,
    '/products.json?handle=' + encodeURIComponent(handle) + '&limit=1',
    'GET'
  );
  const products = (result && result.products) || [];
  return products[0] || null;
}

async function listProducts(limit) {
  // REAL READ
  limit = limit || 50;
  const result = await shopifyRequest(SHOP1, '/products.json?limit=' + limit, 'GET');
  return (result && result.products) || [];
}

async function getShop() {
  // REAL READ auth check
  return shopifyRequest(SHOP1, '/shop.json', 'GET');
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
  isConfigured: function () {
    return !!(SHOP1 && TOKEN1);
  },
};
