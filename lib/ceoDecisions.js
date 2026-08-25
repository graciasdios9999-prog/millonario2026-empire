/**
 * CEO decision layer — priority scoring from real system state.
 */
'use strict';

const shopify = require('./shopifyManager');
const revenueLedger = require('./revenueLedger');
const analytics = require('./analytics');
const leadStore = require('./leadStore');
const store = require('./store');

function prioritize() {
  const items = [];
  const snap = revenueLedger.snapshot();
  const analyticsSummary = analytics.summary();
  const shopifyOk = shopify.isConfigured();
  const products = store.listProducts().length;
  const leads = leadStore.count();

  if (!shopifyOk) {
    items.push({
      id: 'shopify_credentials',
      priority: 'P0',
      title: 'Connect Shopify credentials',
      impact: 'Blocks product publish + order verification',
      effort: 'low',
      roi_score: 100,
    });
  }
  if (!process.env.TRIGGER_SECRET) {
    items.push({
      id: 'trigger_secret',
      priority: 'P0',
      title: 'Set TRIGGER_SECRET',
      impact: 'Blocks protected product write + masterLoop trigger',
      effort: 'low',
      roi_score: 90,
    });
  }
  if ((snap.ORDERS_VERIFIED || 0) === 0 && shopifyOk) {
    items.push({
      id: 'webhook_orders',
      priority: 'P0',
      title: 'Register Shopify orders webhook → VERIFIED ledger',
      impact: 'Enables real revenue measurement',
      effort: 'medium',
      roi_score: 95,
    });
  }
  if (products === 0) {
    items.push({
      id: 'first_product',
      priority: 'P1',
      title: 'Publish first ENTRY + CORE product',
      impact: 'Nothing to sell without catalog',
      effort: 'medium',
      roi_score: 85,
    });
  }
  if (leads === 0) {
    items.push({
      id: 'lead_capture',
      priority: 'P1',
      title: 'Wire landing forms to POST /leads',
      impact: 'No pipeline without leads',
      effort: 'medium',
      roi_score: 70,
    });
  }
  if ((analyticsSummary.counts.page_view || 0) === 0) {
    items.push({
      id: 'tracking',
      priority: 'P1',
      title: 'Emit funnel events from storefront/landing',
      impact: 'Cannot optimize conversion without event data',
      effort: 'medium',
      roi_score: 65,
    });
  }
  items.push({
    id: 'package_lock',
    priority: 'P0',
    title: 'Commit complete package-lock.json (Node 20)',
    impact: 'CI npm ci may fail without synced lock',
    effort: 'low',
    roi_score: 80,
  });
  if (!process.env.OPENAI_API_KEY) {
    items.push({
      id: 'openai',
      priority: 'P2',
      title: 'Configure OPENAI_API_KEY for content',
      impact: 'Content automation limited',
      effort: 'low',
      roi_score: 40,
    });
  }

  items.sort((a, b) => b.roi_score - a.roi_score);
  return {
    generated_at: new Date().toISOString(),
    shopify_configured: shopifyOk,
    REVENUE_VERIFIED: snap.REVENUE_VERIFIED,
    ORDERS_VERIFIED: snap.ORDERS_VERIFIED,
    products_local: products,
    leads,
    priorities: items,
  };
}

module.exports = { prioritize };
