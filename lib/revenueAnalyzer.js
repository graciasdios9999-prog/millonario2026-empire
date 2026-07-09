/**
 * Revenue Metrics Analyzer - V30 Ultra
 * Analyzes DB for revenue insights, trends, and optimization recommendations
 * Super powerful free tool for the god agent
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/millonario_v20_god.db');
const db = new Database(DB_PATH);

async function analyzeRevenueMetrics() {
  console.log('📈 [V30 REVENUE ANALYZER] Analyzing metrics...');

  try {
    const totalActions = db.prepare('SELECT COUNT(*) as count FROM actions').get().count;
    const totalMoney = db.prepare('SELECT SUM(money_impact) as total FROM actions').get().total || 0;
    const recentLearnings = db.prepare('SELECT COUNT(*) as count FROM learnings WHERE date > datetime("now", "-7 days")').get().count;
    const topActions = db.prepare('SELECT type, COUNT(*) as count, SUM(money_impact) as money FROM actions GROUP BY type ORDER BY money DESC LIMIT 5').all();

    const insights = {
      totalActions,
      totalMoneyPotential: totalMoney,
      recentActivity: recentLearnings,
      topRevenueActions: topActions,
      recommendation: totalMoney > 10000 ? 'Scale campaigns and auto-products' : 'Focus on education challenges and WhatsApp sequences'
    };

    console.log('✅ Revenue Analysis complete:', insights);
    return insights;
  } catch (error) {
    console.error('Revenue analysis error:', error.message);
    return { error: error.message };
  }
}

module.exports = { analyzeRevenueMetrics };