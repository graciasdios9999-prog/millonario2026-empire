/**
 * Revenue Metrics Analyzer
 * Reads local SQLite action logs. money_impact values are AI ESTIMATES, not verified sales.
 */

'use strict';

const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = null;
}

const DB_PATH = path.join(__dirname, '../data/millonario_v20_god.db');

async function analyzeRevenueMetrics() {
  console.log('[REVENUE ANALYZER] Analyzing local estimates (not Shopify verified orders)...');

  if (!Database) {
    return {
      error: 'better-sqlite3 unavailable',
      estimatedRevenueUsd: 0,
      verifiedRevenueUsd: null,
      note: 'VERIFIED REVENUE: NOT AVAILABLE from local DB',
    };
  }

  let db;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: false });
  } catch (e) {
    return {
      error: e.message,
      estimatedRevenueUsd: 0,
      verifiedRevenueUsd: null,
      note: 'VERIFIED REVENUE: NOT AVAILABLE',
    };
  }

  try {
    const totalActions = db.prepare('SELECT COUNT(*) as count FROM actions').get()?.count || 0;
    const totalMoney = db.prepare('SELECT SUM(money_impact) as total FROM actions').get()?.total || 0;
    const recentLearnings = db.prepare(
      'SELECT COUNT(*) as count FROM learnings WHERE date > datetime("now", "-7 days")'
    ).get()?.count || 0;
    const topActions = db.prepare(
      'SELECT type, COUNT(*) as count, SUM(money_impact) as estimated_money FROM actions GROUP BY type ORDER BY estimated_money DESC LIMIT 5'
    ).all() || [];

    const insights = {
      totalActions,
      estimatedRevenueUsd: totalMoney,
      verifiedRevenueUsd: null,
      recentActivity: recentLearnings,
      topEstimatedActions: topActions,
      note: 'All money figures are AI ESTIMATES stored in local SQLite, NOT verified Shopify/payment revenue.',
      recommendation:
        totalMoney > 10000
          ? 'Validate estimates against Shopify orders before scaling'
          : 'Focus on real product + checkout before trusting estimates',
    };

    console.log('[REVENUE ANALYZER] ESTIMATED only (not verified):', {
      estimatedRevenueUsd: insights.estimatedRevenueUsd,
      totalActions: insights.totalActions,
    });
    return insights;
  } catch (error) {
    console.error('Revenue analysis error:', error.message);
    return {
      error: error.message,
      estimatedRevenueUsd: 0,
      verifiedRevenueUsd: null,
      note: 'VERIFIED REVENUE: NOT AVAILABLE',
    };
  } finally {
    try {
      if (db) db.close();
    } catch (_) {}
  }
}

module.exports = { analyzeRevenueMetrics };
