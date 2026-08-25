/**
 * Shopify Manager - V20
 * Concrete functions to automate Shopify stores.
 * Credentials come exclusively from process.env via lib/config.js
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
    throw new Error('Shopify not configured. Set SHOPIFY_SHOP_1 and SHOPIFY_ACCESS_TOKEN environment variables.');
  }
}

async function shopifyRequest(shop, endpoint, method = 'GET', data = null) {
  assertConfigured();
  const url = `https://${shop}/admin/api/${API_VERSION}${endpoint}`;
  try {
    const config = {
      method,
      url,
      headers: {
        'X-Shopify-Access-Token': TOKEN1,
        'Content-Type': 'application/json'
      }
    };
    if (data) config.data = data;
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Shopify API error (${shop}${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

async function createProduct(productData) {
  console.log('🛍️ [Shopify] Creating product...');
  const result = await shopifyRequest(SHOP1, '/products.json', 'POST', { product: productData });
  console.log('✅ Product created:', result.product?.id);
  return result.product;
}

async function getOrders(limit = 10, status = 'any') {
  console.log('📦 [Shopify] Fetching orders...');
  const result = await shopifyRequest(SHOP1, `/orders.json?limit=${limit}&status=${status}`);
  return result.orders || [];
}

async function updateInventory(inventoryItemId, newQuantity) {
  console.log(`📊 [Shopify] Updating inventory for item ${inventoryItemId} to ${newQuantity}...`);
  const result = await shopifyRequest(SHOP1, `/inventory_levels/set.json`, 'POST', {
    location_id: process.env.SHOPIFY_LOCATION_ID || 1,
    inventory_item_id: inventoryItemId,
    available: newQuantity
  });
  console.log('✅ Inventory updated');
  return result;
}

async function syncStores() {
  console.log('🔄 [Shopify] Syncing between stores...');
  if (!SHOP2) {
    console.warn('SHOPIFY_SHOP_2 not set - sync limited to read from SHOP1');
  }
  const products1 = await shopifyRequest(SHOP1, '/products.json?limit=50');
  console.log(`✅ Read ${products1.products?.length || 0} products from SHOP1`);
  return { synced: products1.products?.length || 0, note: 'Write to SHOP2 not implemented' };
}

async function processOrder(orderId, action = 'fulfill') {
  console.log(`📋 [Shopify] Processing order ${orderId}...`);
  if (action === 'fulfill') {
    const result = await shopifyRequest(SHOP1, `/orders/${orderId}/fulfillments.json`, 'POST', {
      fulfillment: { location_id: process.env.SHOPIFY_LOCATION_ID || 1, tracking_number: 'AUTO-' + Date.now() }
    });
    return result;
  }
  return { status: 'processed' };
}

async function createDiscount(code, percentage) {
  console.log(`💰 [Shopify] Creating discount ${code}...`);
  const result = await shopifyRequest(SHOP1, '/price_rules.json', 'POST', {
    price_rule: {
      title: code,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'percentage',
      value: -percentage,
      customer_selection: 'all',
      starts_at: new Date().toISOString()
    }
  });
  return result.price_rule;
}

async function autoCreateRevenueProduct(topic) {
  const productData = {
    title: `Auto Bundle: ${topic} - Revenue Edition`,
    body_html: `<p>Producto generado automáticamente por el Agente basado en ${topic}.</p>`,
    vendor: 'MiDeli Reset Lab',
    product_type: 'Bundle Educativo',
    variants: [{
      price: '29.99',
      sku: `AUTO-${Date.now()}`,
      inventory_quantity: 100
    }]
  };
  return await createProduct(productData);
}

module.exports = {
  createProduct,
  getOrders,
  updateInventory,
  syncStores,
  processOrder,
  createDiscount,
  autoCreateRevenueProduct,
  isConfigured: () => !!(SHOP1 && TOKEN1)
};
