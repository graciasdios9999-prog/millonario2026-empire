/**
 * Product Engine — create/publish products with idempotency.
 * Shopify writes only when configured. dryRun never calls Admin API.
 */
'use strict';

const crypto = require('crypto');
const shopify = require('./shopifyManager');
const store = require('./store');
const logger = require('./logger');

const OFFER_TIERS = {
  ENTRY: { defaultPrice: '9.99', tag: 'offer:entry' },
  CORE: { defaultPrice: '29.99', tag: 'offer:core' },
  PREMIUM: { defaultPrice: '97.00', tag: 'offer:premium' },
  BUNDLE: { defaultPrice: '49.99', tag: 'offer:bundle' },
  UPSELL: { defaultPrice: '19.99', tag: 'offer:upsell' },
  CROSS_SELL: { defaultPrice: '14.99', tag: 'offer:cross-sell' },
};

function slugify(text) {
  return String(text || 'product')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 80);
}

function buildIdempotencyKey(input) {
  if (input.idempotencyKey) return String(input.idempotencyKey);
  const base = [input.handle || '', input.title || '', input.tier || '', input.sku || ''].join('|');
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32);
}

function buildProductPayload(input) {
  const tier = OFFER_TIERS[input.tier] || OFFER_TIERS.CORE;
  const title = input.title || 'Untitled Product';
  const handle = input.handle || slugify(title);
  const price = String(input.price != null ? input.price : tier.defaultPrice);
  const compareAt = input.compareAtPrice != null ? String(input.compareAtPrice) : undefined;
  const tags = Array.from(
    new Set([...(input.tags || []), tier.tag, 'source:product-engine', input.tier || 'CORE'].filter(Boolean))
  ).join(', ');

  const bodyHtml =
    input.bodyHtml ||
    '<h2>' +
      title +
      '</h2><p>' +
      (input.description || 'Digital product from Midlife Reset Lab / Empire catalog.') +
      '</p><ul>' +
      (input.benefits || []).map((b) => '<li>' + b + '</li>').join('') +
      '</ul>';

  const variant = {
    price,
    sku: input.sku || ('ENG-' + handle).toUpperCase().slice(0, 40),
    inventory_management: input.trackInventory ? 'shopify' : null,
    inventory_quantity: input.inventoryQuantity != null ? input.inventoryQuantity : 100,
  };
  if (compareAt) variant.compare_at_price = compareAt;

  return {
    title,
    body_html: bodyHtml,
    vendor: input.vendor || 'MiDeli Reset Lab',
    product_type: input.productType || input.tier || 'Digital',
    tags,
    handle,
    status: input.status || 'draft',
    variants: [variant],
    metafields_global_title_tag: input.seoTitle || title,
    metafields_global_description_tag: input.seoDescription || (input.description || title).slice(0, 155),
  };
}

async function createProduct(input) {
  input = input || {};
  const started = Date.now();
  const key = buildIdempotencyKey(input);
  const existing = store.getProductByKey(key);
  if (existing && existing.shopify_product_id) {
    logger.success('productEngine.createProduct', {
      idempotency_key: key,
      duplicate: true,
      entity_id: existing.shopify_product_id,
      duration_ms: Date.now() - started,
    });
    return { status: 'SUCCESS', duplicate: true, product: existing, shopify_write: false };
  }

  const payload = buildProductPayload(
    Object.assign({}, input, { handle: input.handle || slugify(input.title) })
  );
  const dryRun = input.dryRun === true || !shopify.isConfigured();

  if (dryRun) {
    const local = store.saveProduct(key, {
      id: key,
      title: payload.title,
      handle: payload.handle,
      price: payload.variants[0].price,
      tier: input.tier || 'CORE',
      shopify_product_id: null,
      status: 'LOCAL_ONLY',
      reason: shopify.isConfigured() ? 'dry_run' : 'shopify_not_configured',
      payload,
    });
    logger.blocked('productEngine.createProduct', {
      idempotency_key: key,
      reason: local.reason,
      duration_ms: Date.now() - started,
    });
    return {
      status: 'BLOCKED',
      duplicate: false,
      product: local,
      shopify_write: false,
      reason: local.reason,
    };
  }

  try {
    if (typeof shopify.findProductByHandle === 'function') {
      const found = await shopify.findProductByHandle(payload.handle);
      if (found && found.id) {
        const saved = store.saveProduct(key, {
          id: key,
          title: found.title,
          handle: found.handle,
          shopify_product_id: found.id,
          status: found.status || 'active',
          source: 'shopify_existing',
        });
        return { status: 'SUCCESS', duplicate: true, product: saved, shopify_write: false };
      }
    }

    const created = await shopify.createProduct(payload);
    const product = created.product || created;
    const saved = store.saveProduct(key, {
      id: key,
      title: product.title || payload.title,
      handle: product.handle || payload.handle,
      shopify_product_id: product.id,
      status: product.status || payload.status,
      price: payload.variants[0].price,
      tier: input.tier || 'CORE',
      source: 'shopify_create',
    });
    logger.success('productEngine.createProduct', {
      idempotency_key: key,
      entity_id: product.id,
      duration_ms: Date.now() - started,
      shopify_write: true,
    });
    return { status: 'SUCCESS', duplicate: false, product: saved, shopify_write: true };
  } catch (e) {
    logger.failed('productEngine.createProduct', {
      idempotency_key: key,
      error: e.message,
      duration_ms: Date.now() - started,
    });
    return { status: 'FAILED', error: e.message, shopify_write: false };
  }
}

function catalogArchitecture() {
  return {
    ENTRY: { role: 'low-friction entry', defaultPrice: OFFER_TIERS.ENTRY.defaultPrice },
    CORE: { role: 'main offer', defaultPrice: OFFER_TIERS.CORE.defaultPrice },
    PREMIUM: { role: 'high-ticket', defaultPrice: OFFER_TIERS.PREMIUM.defaultPrice },
    BUNDLE: { role: 'increase AOV', defaultPrice: OFFER_TIERS.BUNDLE.defaultPrice },
    UPSELL: { role: 'post-purchase upsell', defaultPrice: OFFER_TIERS.UPSELL.defaultPrice },
    CROSS_SELL: { role: 'related attach', defaultPrice: OFFER_TIERS.CROSS_SELL.defaultPrice },
    funnel: ['TRAFFIC', 'LANDING', 'PRODUCT', 'CHECKOUT(Shopify)', 'PURCHASE', 'UPSELL', 'CRM', 'REPEAT'],
    note: 'Checkout/payment owned by Shopify storefront. This engine prepares catalog + Admin API.',
  };
}

module.exports = {
  createProduct,
  buildProductPayload,
  buildIdempotencyKey,
  catalogArchitecture,
  OFFER_TIERS,
  slugify,
};
