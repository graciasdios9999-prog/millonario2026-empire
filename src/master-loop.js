/**
 * CEO-DIOS EMPIRE V20 GOD LEVEL - MASTER LOOP
 * Combines: Video Engine (HeyGen) + Self-Study AI + Shopify + Trading + Leads + Content
 */

const { generateContent } = require('./content/generator');
const { distributeContent } = require('./publishing/distributor');
const { autonomousSelfStudy } = require('../lib/selfStudyAgent');

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

  console.log('=== CEO-DIOS EMPIRE V20 MASTER LOOP ===');
  console.log(`time=${results.timestamp}`);
  console.log('ESTIMATED revenue signals only until Shopify orders verified');

  try {
    console.log('[SELF-STUDY] starting');
    const studyResult = await autonomousSelfStudy();
    results.modules.SELF_STUDY = {
      status: 'success',
      topics_studied: studyResult.studied?.length || 0,
      estimated_revenue_usd: studyResult.totalMoneyImpact || 0,
    };
    console.log(`[SELF-STUDY] topics=${studyResult.studied?.length || 0} ESTIMATED revenue USD $${studyResult.totalMoneyImpact || 0} (not verified sales)`);
  } catch (error) {
    results.modules.SELF_STUDY = { status: 'error', error: error.message };
    console.error(`[SELF-STUDY] ${error.message}`);
  }

  if (executeTradingCycle && process.env.ALPACA_API_KEY) {
    try {
      console.log('[TRADING] starting');
      const tradingResult = await executeTradingCycle();
      results.modules.TRADING = { status: 'success', data: tradingResult };
      console.log('[TRADING] completed');
    } catch (error) {
      results.modules.TRADING = { status: 'error', error: error.message };
      console.error(`[TRADING] ${error.message}`);
    }
  } else {
    results.modules.TRADING = { status: 'skipped', reason: 'not_configured' };
  }

  let generatedContent = [];
  try {
    console.log('[CONTENT] generating');
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
    console.log(`[CONTENT] videos=${contentResult.totalGenerated}`);
  } catch (error) {
    results.modules.CONTENT = { status: 'error', error: error.message };
    console.error(`[CONTENT] ${error.message}`);
  }

  try {
    console.log('[PUBLISHING] distributing');
    const distResult = await distributeContent(generatedContent);
    results.modules.PUBLISHING = { status: 'success', data: distResult };
    console.log(`[PUBLISHING] published=${distResult.published}`);
  } catch (error) {
    results.modules.PUBLISHING = { status: 'error', error: error.message };
    console.error(`[PUBLISHING] ${error.message}`);
  }

  if (manageLeads && process.env.HUBSPOT_API_KEY) {
    try {
      console.log('[LEADS] managing');
      const leadsResult = await manageLeads();
      results.modules.LEADS = { status: 'success', data: leadsResult };
    } catch (error) {
      results.modules.LEADS = { status: 'error', error: error.message };
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  results.elapsed_seconds = parseFloat(elapsed);

  console.log(`=== MASTER LOOP COMPLETE ${elapsed}s ===`);
  console.log(`modules=${JSON.stringify(Object.entries(results.modules).map(([k, v]) => k + ':' + v.status))}`);

  if (process.env.ZAPIER_WEBHOOK_URL) {
    try {
      const axios = require('axios');
      await axios.post(process.env.ZAPIER_WEBHOOK_URL, results);
      console.log('[WEBHOOK] reported');
    } catch (e) {
      console.error('[WEBHOOK] failed:', e.message);
    }
  }

  return results;
}

// Only auto-run when executed directly (CLI / npm run master-loop / GitHub Actions).
// Prevents side-effect execution on require() from index.js.
if (require.main === module) {
  masterLoop()
    .then((r) => {
      console.log(`Exit: SUCCESS V20 (${r.modules.CONTENT?.videos_generated || 0} videos + Self-Study)`);
      process.exit(0);
    })
    .catch((e) => {
      console.error('FATAL V20:', e);
      process.exit(1);
    });
}

module.exports = { masterLoop };
