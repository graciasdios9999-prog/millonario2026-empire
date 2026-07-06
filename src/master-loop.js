/**
 * CEO-DIOS EMPIRE V12 - MASTER LOOP
 * AUTONOMOUS VIDEO ENGINE: 7 HeyGen videos/day
 * 
 * Cycle: Trading -> Generate Video Scripts -> HeyGen Render -> Distribute
 * YouTube (Midlife Reset) + Facebook (Cuba/Patria y Vida)
 */

const { generateContent } = require('./content/generator');
const { distributeContent } = require('./publishing/distributor');

// Trading and Leads are optional modules
let executeTradingCycle, manageLeads;
try { executeTradingCycle = require('./trading/alpaca-engine').executeTradingCycle; } catch(e) { executeTradingCycle = null; }
try { manageLeads = require('./leads/hubspot-manager').manageLeads; } catch(e) { manageLeads = null; }

async function masterLoop() {
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    version: 'V12.0',
    mode: 'HEYGEN_VIDEO_ONLY',
    modules: {},
  };

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏆 CEO-DIOS EMPIRE V12.0 - AUTONOMOUS VIDEO ENGINE');
  console.log(`  ⏰ ${results.timestamp}`);
  console.log('  🎬 Mode: 7 HeyGen videos/day (ZERO static images)');
  console.log('  📺 YouTube: Midlife Reset Lab | 📘 Facebook: Patria y Vida');
  console.log('═══════════════════════════════════════════════════════════════');

  // === MODULE 1: TRADING (if configured) ===
  if (executeTradingCycle && process.env.ALPACA_API_KEY) {
    try {
      console.log('\n▶ [TRADING] Starting algorithmic cycle...');
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

  // === MODULE 2: VIDEO CONTENT GENERATION ===
  let generatedContent = [];
  try {
    console.log('\n▶ [CONTENT] Generating HeyGen video scripts + rendering...');
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

  // === MODULE 3: DISTRIBUTION (YouTube + Facebook) ===
  try {
    console.log('\n▶ [PUBLISHING] Distributing videos to YouTube + Facebook...');
    const distResult = await distributeContent(generatedContent);
    results.modules.PUBLISHING = { status: 'success', data: distResult };
    console.log(`✓ [PUBLISHING] ${distResult.published} videos published`);
  } catch (error) {
    results.modules.PUBLISHING = { status: 'error', error: error.message };
    console.error(`✗ [PUBLISHING] ${error.message}`);
  }

  // === MODULE 4: LEADS (if configured) ===
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
  console.log(`  🏁 V12 MASTER LOOP COMPLETE - ${elapsed}s`);
  console.log(`  📊 ${JSON.stringify(Object.entries(results.modules).map(([k, v]) => `${k}:${v.status}`))}`);
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

// Execute
masterLoop()
  .then((r) => {
    console.log(`\nExit: SUCCESS (${r.modules.CONTENT?.videos_generated || 0} videos)`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });

module.exports = { masterLoop };
