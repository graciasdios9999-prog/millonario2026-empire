/**
 * Revenue ledger — strict separation VERIFIED vs ESTIMATED.
 * Only Shopify/payment orders become VERIFIED.
 */
'use strict';

const store = require('./store');
const logger = require('./logger');

function snapshot() {
  const verified = store.getVerifiedRevenueSummary();
  return {
    REVENUE_VERIFIED: verified.REVENUE_VERIFIED,
    REVENUE_ESTIMATED: 0,
    ORDERS_VERIFIED: verified.ORDERS_VERIFIED,
    ORDERS_ESTIMATED: 0,
    PROFIT_VERIFIED: null,
    PROFIT_ESTIMATED: null,
    AOV_VERIFIED: verified.AOV_VERIFIED,
    note: 'REVENUE_VERIFIED only from recorded Shopify orders. AI predictions are never promoted to VERIFIED.',
  };
}

function ingestShopifyOrder(order) {
  if (!order || !(order.id || order.order_id)) {
    logger.failed('revenue.ingestShopifyOrder', { error: 'missing order id' });
    return { status: 'FAILED', reason: 'missing_order_id' };
  }
  const result = store.recordVerifiedOrder(order);
  if (result.duplicate) {
    logger.info('revenue.ingestShopifyOrder', 'SUCCESS', {
      order_id: result.order.id,
      duplicate: true,
    });
    return { status: 'SUCCESS', duplicate: true, order: result.order, revenue_type: 'VERIFIED' };
  }
  logger.verified('revenue.ingestShopifyOrder', {
    order_id: result.order.id,
    amount: result.order.total_price,
    currency: result.order.currency,
  });
  return { status: 'SUCCESS', duplicate: false, order: result.order, revenue_type: 'VERIFIED' };
}

function recordEstimated(amount, reason) {
  logger.estimated('revenue.estimated', {
    amount: Number(amount) || 0,
    reason: reason || 'ai_estimate',
  });
  return {
    status: 'ESTIMATED',
    amount: Number(amount) || 0,
    revenue_type: 'ESTIMATED',
    note: 'Not a sale. Do not report as revenue generated.',
  };
}

module.exports = {
  snapshot,
  ingestShopifyOrder,
  recordEstimated,
};
