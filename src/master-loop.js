/**
 * CEO-DIOS EMPIRE V20 GOD LEVEL - MASTER LOOP
 * AUTONOMOUS REVENUE & EDUCATION EMPIRE
 * 
 * Combines: Video Engine (HeyGen) + Self-Study God AI + Shopify/WhatsApp + Trading + Leads + Content
 * Self-improving, self-teaching, revenue-generating machine
 * Advanced AI: GPT-4o with Chain-of-Thought, Self-Reflection, Future Market Prediction
 */

const { generateContent } = require('./content/generator');
const { distributeContent } = require('./publishing/distributor');
const { autonomousSelfStudy } = require('../lib/selfStudyAgent');

// Trading and Leads optional
let executeTradingCycle, manageLeads;
try { executeTradingCycle = require('./trading/alpaca-engine').executeTradingCycle; } catch(e) { executeTradingCycle = null; }
try { manageLeads = require('./leads/hubspot-manager').manageLeads; } catch(e) { manageLeads = null; }

async function masterLoop() {
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    version: 'V20.0 GOD LEVEL',
    mode: 'FULL_AUTONOMOUS_EMPIRE',
    modules: {},
  };

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏆 CEO-DIOS EMPIRE V20 GOD LEVEL - AUTONOMOUS REVENUE & EDUCATION EMPIRE');
  console.log(`  ⏰ ${results.timestamp}`);
  console.log('  🎬 7 HeyGen videos/day + Self-Study AI God + Shopify/WhatsApp + Trading');
  console.log('  🧠 Advanced AI: GPT-4o CoT + Self-Reflection + Future Market Prediction 2026-2030');
  console.log('  📺 YouTube + Facebook | 💰 Revenue Autonomous | 📚 Finelo-style Education');
  console.log('═══════════════════════════════════════════════════════════════');

  // === MODULE 0: SELF-STUDY GOD AI (NEW V20 - runs in parallel or first) ===
  try {
    console.log('\n▶ [SELF-STUDY GOD] Iniciando auto-estudio masivo con IA más poderosa...');
    const studyResult = await autonomousSelfStudy();
    results.modules.SELF_STUDY = {
      status: 'success',
      topics_studied: studyResult.studied?.length || 0,
      money_impact: studyResult.totalMoneyImpact || 0,
    };
    console.log(`✓ [SELF-STUDY GOD] Completado - ${studyResult.studied?.length || 0} temas, $${studyResult.totalMoneyImpact || 0} revenue potential`);
  } catch (error) {
    results.modules.SELF_STUDY = { status: 'error', error: error.message };
    console.error(`✗ [SELF-STUDY GOD] ${error.message}`);
  }

  // === MODULE 1: TRADING (enhanced with AI insights) ===
  if (executeTradingCycle && process.env.ALPACA_API_KEY) {
    try {
      console.log('\n▶ [TRADING] Starting algorithmic cycle (AI-enhanced)...');
      const tradingResult = await executeTradingCycle();
      results.modules.TRADING = { status: 'success', data: tradingResult };
      console.log('✓ [TRADING] Completed');
    } catch (error) {
      results.modules.TRADING = { status: 'error', error: error.message };
      console.error(`✗ [TRADING] ${error.message}`);
    }
  } else {
    results.modules.TRADING = { status: 'skipped', reason: 'not_configured' };
  }

  // === MODULE 2: VIDEO CONTENT GENERATION (AI-god enhanced) ===
  let generatedContent = [];
  try {
    console.log('\n▶ [CONTENT] Generating HeyGen video scripts with AI God insights...');
    const contentResult = await generateContent();
    generatedContent = contentResult.content || [];
    results.modules.CONTENT = {
      status: 'success',
      videos_generated: contentResult.totalGenerated,
      breakdown: {
        midlife: generatedContent.filter(c => c.type === 'midlife_reset').length,
        cuba: generatedContent.filter(c => c.type === 'cuba_content').length,
      },
    };
    console.log(`✓ [CONTENT] ${contentResult.totalGenerated} videos rendered`);
  } catch (error) {
    results.modules.CONTENT = { status: 'error', error: error.message };
    console.error(`✗ [CONTENT] ${error.message}`);
  }

  // === MODULE 3: DISTRIBUTION ===
  try {
    console.log('\n▶ [PUBLISHING] Distributing videos...');
    const distResult = await distributeContent(generatedContent);
    results.modules.PUBLISHING = { status: 'success', data: distResult };
    console.log(`✓ [PUBLISHING] ${distResult.published} videos published`);
  } catch (error) {
    results.modules.PUBLISHING = { status: 'error', error: error.message };
    console.error(`✗ [PUBLISHING] ${error.message}`);
  }

  // === MODULE 4: LEADS ===
  if (manageLeads && process.env.HUBSPOT_API_KEY) {
    try {
      console.log('\n▶ [LEADS] Managing leads...');
      const leadsResult = await manageLeads();
      results.modules.LEADS = { status: 'success', data: leadsResult };
    } catch (error) {
      results.modules.LEADS = { status: 'error', error: error.message };
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  results.elapsed_seconds = parseFloat(elapsed);

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  🏁 V20 GOD MASTER LOOP COMPLETE - ${elapsed}s`);
  console.log(`  📊 Modules: ${JSON.stringify(Object.entries(results.modules).map(([k, v]) => `${k}:${v.status}`))}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Report to webhook
  if (process.env.ZAPIER_WEBHOOK_URL) {
    try {
      const axios = require('axios');
      await axios.post(process.env.ZAPIER_WEBHOOK_URL, results);
      console.log('  📡 Results reported to webhook');
    } catch (e) {
      console.error('  Webhook report failed:', e.message);
    }
  }

  return results;
}

// Export for use by index.js and other modules.
// Only auto-run when this file is executed directly (CLI / npm run master-loop).
// Prevents side-effect execution on require() which caused double loops and unwanted starts.
if (require.main === module) {
  masterLoop()
    .then((r) => {
      console.log(`\nExit: SUCCESS V20 GOD (${r.modules.CONTENT?.videos_generated || 0} videos + Self-Study)`);
      process.exit(0);
    })
    .catch((e) => {
      console.error('FATAL V20:', e);
      process.exit(1);
    });
}

module.exports = { masterLoop };
