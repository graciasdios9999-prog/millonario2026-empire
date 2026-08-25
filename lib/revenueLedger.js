/**
 * Revenue ledger — VERIFIED only from payment webhooks. Never promote ESTIMATED.
 */
'use strict';

const store = require('./store');
const logger = require('./logger');

function snapshot() {
  const verified = store.getVerifiedRevenueSummary();
  return {
    REVENUE_VERIFIED: verified.REVENUE_VERIFIED,
    REVENUE_REFUNDED: verified.REVENUE_REFUNDED,
    NET_REVENUE: verified.NET_REVENUE,
    REVENUE_ESTIMATED: 0,
    ORDERS_VERIFIED: verified.ORDERS_VERIFIED,
    REFUNDS_COUNT: verified.REFUNDS_COUNT,
    ORDERS_ESTIMATED: 0,
    AOV_VERIFIED: verified.AOV_VERIFIED,
    by_product: verified.by_product,
    by_source: verified.by_source,
    by_campaign: verified.by_campaign,
    note: 'REVENUE_VERIFIED only from verified Stripe Checkout or Shopify orders. AI predictions never become VERIFIED.',
  };
}

function ingestShopifyOrder(order) {
  if (!order || !(order.id || order.order_id)) {
    logger.failed('revenue.ingestOrder', { error: 'missing order id' });
    return { status: 'FAILED', reason: 'missing_order_id' };
  }
  const result = store.recordVerifiedOrder(order);
  if (result.error) return { status: 'FAILED', reason: result.error };
  if (result.duplicate) {
    logger.info('revenue.ingestOrder', 'SUCCESS', { order_id: result.order.id, duplicate: true });
    return { status: 'SUCCESS', duplicate: true, order: result.order, revenue_type: 'VERIFIED' };
  }
  logger.verified('revenue.ingestOrder', {
    order_id: result.order.id,
    amount: result.order.total_price,
    currency: result.order.currency,
    product_key: result.order.product_key,
  });
  return { status: 'SUCCESS', duplicate: false, order: result.order, revenue_type: 'VERIFIED' };
}

function ingestRefund(refund) {
  const result = store.recordRefund(refund);
  if (result.status === 'FAILED') return result;
  logger.info('revenue.refund', result.duplicate ? 'SUCCESS' : 'VERIFIED', {
    refund_id: result.refund.id,
    amount: result.refund.amount,
    duplicate: !!result.duplicate,
  });
  return result;
}

function recordEstimated(amount, reason) {
  logger.estimated('revenue.estimated', { amount: Number(amount) || 0, reason: reason || 'ai_estimate' });
  return {
    status: 'ESTIMATED',
    amount: Number(amount) || 0,
    revenue_type: 'ESTIMATED',
    note: 'Not a sale. Do not report as revenue generated.',
  };
}

module.exports = { snapshot, ingestShopifyOrder, ingestRefund, recordEstimated };
