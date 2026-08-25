/**
 * Offer engine — scoring, stacks, discount rules (no fake revenue).
 */
'use strict';

const crypto = require('crypto');
const logger = require('./logger');

const FUNNEL = ['ENTRY', 'CORE', 'PREMIUM', 'BUNDLE', 'UPSELL', 'CROSS_SELL'];

function clamp(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function scoreProduct(input) {
  const i = input || {};
  const demand = clamp(Number(i.demand != null ? i.demand : 50), 0, 100);
  const margin = clamp(Number(i.margin != null ? i.margin : 50), 0, 100);
  const competition = clamp(Number(i.competition != null ? i.competition : 50), 0, 100);
  const priceFit = clamp(Number(i.priceFit != null ? i.priceFit : 50), 0, 100);
  const aovPotential = clamp(Number(i.aovPotential != null ? i.aovPotential : 50), 0, 100);
  const upsellPotential = clamp(Number(i.upsellPotential != null ? i.upsellPotential : 50), 0, 100);
  const repeatPotential = clamp(Number(i.repeatPotential != null ? i.repeatPotential : 50), 0, 100);
  const score = Math.round(
    demand * 0.2 + margin * 0.2 + priceFit * 0.15 + aovPotential * 0.15 +
    upsellPotential * 0.1 + repeatPotential * 0.1 + (100 - competition) * 0.1
  );
  const finalScore = clamp(score, 0, 100);
  const publishReady = finalScore >= 60;
  const recommendation = publishReady ? 'PUBLISH_CANDIDATE' : finalScore >= 40 ? 'IMPROVE_OFFER' : 'SKIP';
  const result = {
    score: finalScore, publishReady, recommendation,
    signals: { demand, margin, competition, priceFit, aovPotential, upsellPotential, repeatPotential },
    tier: i.tier || 'CORE',
  };
  logger.info('offerEngine.scoreProduct', 'SUCCESS', { score: finalScore, recommendation, tier: result.tier });
  return result;
}

function buildOfferStack(core) {
  const title = (core && core.title) || 'Core Offer';
  const basePrice = Number((core && core.price) || 29.99);
  return {
    ENTRY: { role: 'low-friction entry', title: title + ' — Starter', suggestedPrice: Math.max(7, Math.round(basePrice * 0.33 * 100) / 100), tier: 'ENTRY' },
    CORE: { role: 'main offer', title: title, suggestedPrice: basePrice, tier: 'CORE' },
    PREMIUM: { role: 'high-ticket', title: title + ' — Premium', suggestedPrice: Math.round(basePrice * 3.2 * 100) / 100, tier: 'PREMIUM' },
    BUNDLE: { role: 'increase AOV', title: title + ' + Bonuses Bundle', suggestedPrice: Math.round(basePrice * 1.6 * 100) / 100, tier: 'BUNDLE' },
    UPSELL: { role: 'post-purchase / checkout upsell', title: 'Add-on for ' + title, suggestedPrice: Math.round(basePrice * 0.55 * 100) / 100, tier: 'UPSELL' },
    CROSS_SELL: { role: 'related attach', title: 'Related for ' + title, suggestedPrice: Math.round(basePrice * 0.4 * 100) / 100, tier: 'CROSS_SELL' },
    funnel: FUNNEL,
    note: 'Prices are suggested architecture only — not verified revenue.',
  };
}

function createOfferRule(input) {
  const i = input || {};
  const type = i.type || 'percent';
  const allowed = ['percent', 'fixed', 'bundle', 'upsell', 'cross_sell', 'limited', 'lead', 'first_purchase'];
  if (!allowed.includes(type)) return { status: 'FAILED', error: 'invalid_type' };
  if (type === 'percent') {
    const v = Number(i.value);
    if (!(v > 0 && v <= 50)) return { status: 'FAILED', error: 'percent_must_be_1_to_50' };
  }
  if (type === 'fixed') {
    const v = Number(i.value);
    if (!(v > 0 && v < 1000)) return { status: 'FAILED', error: 'fixed_discount_out_of_range' };
  }
  const id = i.id || 'off_' + crypto.createHash('sha256').update(JSON.stringify(i) + Date.now()).digest('hex').slice(0, 12);
  const rule = {
    id, type, value: i.value != null ? Number(i.value) : null, code: i.code || null,
    productId: i.productId || null, tier: i.tier || null,
    maxUses: i.maxUses != null ? Number(i.maxUses) : 100, used: 0,
    expiresAt: i.expiresAt || null, active: i.active !== false, created_at: new Date().toISOString(),
  };
  logger.info('offerEngine.createOfferRule', 'SUCCESS', { id: rule.id, type: rule.type });
  return { status: 'SUCCESS', rule };
}

function isOfferEligible(rule, context) {
  if (!rule || !rule.active) return { eligible: false, reason: 'inactive' };
  if (rule.expiresAt && new Date(rule.expiresAt) < new Date()) return { eligible: false, reason: 'expired' };
  if (rule.maxUses != null && rule.used >= rule.maxUses) return { eligible: false, reason: 'max_uses' };
  if (rule.tier && context && context.tier && rule.tier !== context.tier) return { eligible: false, reason: 'tier_mismatch' };
  return { eligible: true };
}

module.exports = { scoreProduct, buildOfferStack, createOfferRule, isOfferEligible, FUNNEL };
