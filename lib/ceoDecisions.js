/**
 * CEO decision layer — prioritize FIRST SALE then scale.
 */
'use strict';

const shopify = require('./shopifyManager');
const stripeCheckout = require('./stripeCheckout');
const revenueLedger = require('./revenueLedger');
const analytics = require('./analytics');
const leadStore = require('./leadStore');
const store = require('./store');

function prioritize() {
  const items = [];
  const snap = revenueLedger.snapshot();
  const analyticsSummary = analytics.summary();
  const shopifyOk = shopify.isConfigured();
  const stripeOk = stripeCheckout.isConfigured();
  const products = store.listProducts().length;
  const leads = leadStore.count();
  const orders = snap.ORDERS_VERIFIED || 0;

  if (!stripeOk) {
    items.push({ id: 'stripe_secret', priority: 'P0', title: 'Set STRIPE_SECRET_KEY to enable live Checkout', impact: 'Blocks first real payment', effort: 'low', roi_score: 100 });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    items.push({ id: 'stripe_webhook', priority: 'P0', title: 'Set STRIPE_WEBHOOK_SECRET + register /webhook-stripe', impact: 'Without webhook, purchases may not enter VERIFIED ledger', effort: 'low', roi_score: 98 });
  }
  if (!process.env.PUBLIC_BASE_URL) {
    items.push({ id: 'public_base_url', priority: 'P0', title: 'Set PUBLIC_BASE_URL for success/cancel URLs', impact: 'Checkout redirects need absolute URLs in production', effort: 'low', roi_score: 92 });
  }
  if (orders === 0 && stripeOk) {
    items.push({ id: 'first_sale', priority: 'P0', title: 'Drive traffic to /offer.html and complete first $47 sale', impact: 'Validates entire monetization path', effort: 'medium', roi_score: 95 });
  }
  if (orders >= 1) {
    items.push({ id: 'upsell_curso', priority: 'P1', title: 'Activate post-purchase upsell to curso-30 ($97)', impact: 'Increases AOV after ENTRY conversion', effort: 'medium', roi_score: 80 });
  }
  if (leads === 0) {
    items.push({ id: 'traffic_to_offer', priority: 'P1', title: 'Send traffic to /offer.html?utm_source=...&utm_campaign=...', impact: 'No leads without visitors', effort: 'medium', roi_score: 85 });
  }
  if (!shopifyOk) {
    items.push({ id: 'shopify_optional', priority: 'P2', title: 'Shopify optional — Stripe path works alone for digital products', impact: 'Enables product catalog sync when ready', effort: 'medium', roi_score: 40 });
  }
  if (!process.env.TRIGGER_SECRET) {
    items.push({ id: 'trigger_secret', priority: 'P2', title: 'Set TRIGGER_SECRET for admin product writes', impact: 'Protects /products and /trigger', effort: 'low', roi_score: 50 });
  }
  if ((analyticsSummary.counts && analyticsSummary.counts.page_view) === 0) {
    items.push({ id: 'tracking_live', priority: 'P1', title: 'Open /offer.html once deployed to start funnel events', impact: 'Enables conversion diagnostics', effort: 'low', roi_score: 70 });
  }

  items.sort((a, b) => b.roi_score - a.roi_score);
  return {
    generated_at: new Date().toISOString(),
    first_sale_ready: stripeOk,
    stripe_configured: stripeOk,
    shopify_configured: shopifyOk,
    REVENUE_VERIFIED: snap.REVENUE_VERIFIED,
    ORDERS_VERIFIED: orders,
    products_local: products,
    leads,
    priorities: items,
  };
}

module.exports = { prioritize };
