/**
 * V12 Test Cycle - Validates one full cycle without publishing
 * Tests: OpenAI script generation + HeyGen submission + (optionally) polling
 */

require('dotenv').config();
const { generateVideoScript } = require('./content/generator');
const { submitHeyGenVideo } = require('./content/generator');

async function testCycle() {
  console.log('🧪 V12 TEST CYCLE - Validating pipeline...\n');
  
  const checks = {
    openai: false,
    heygen_submit: false,
    env_vars: {},
  };

  // Check environment
  const requiredVars = ['OPENAI_API_KEY', 'HEYGEN_API_KEY'];
  const optionalVars = ['FACEBOOK_PAGE_TOKEN', 'YOUTUBE_REFRESH_TOKEN', 'ZAPIER_WEBHOOK_URL'];
  
  for (const v of requiredVars) {
    checks.env_vars[v] = !!process.env[v];
    if (!process.env[v]) {
      console.error(`❌ REQUIRED: ${v} is missing`);
      return checks;
    }
  }
  
  for (const v of optionalVars) {
    checks.env_vars[v] = !!process.env[v];
    console.log(`  ${process.env[v] ? '✅' : '⚠️'} ${v}: ${process.env[v] ? 'SET' : 'NOT SET'}`);
  }

  // Test OpenAI script generation
  console.log('\n📝 Testing OpenAI script generation...');
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const script = await generateVideoScript(openai, 'fitness after 40 - getting started', 'midlife_reset');
    console.log(`  ✅ Script generated (${script.length} chars)`);
    console.log(`  Preview: "${script.substring(0, 100)}..."`);
    checks.openai = true;
  } catch (e) {
    console.error(`  ❌ OpenAI failed: ${e.message}`);
  }

  // Test HeyGen submission
  if (checks.openai) {
    console.log('\n🎬 Testing HeyGen video submission...');
    try {
      const testScript = 'This is a test video from Empire V12. The autonomous video engine is now operational. Midlife Reset Lab dot com.';
      const videoId = await submitHeyGenVideo(testScript, 'midlife_reset', 'V12 Test');
      console.log(`  ✅ HeyGen video submitted: ${videoId}`);
      console.log(`  💡 Check status: node src/content/heygen-status.js ${videoId}`);
      checks.heygen_submit = true;
    } catch (e) {
      console.error(`  ❌ HeyGen failed: ${e.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  TEST RESULTS:');
  console.log(`  OpenAI: ${checks.openai ? '✅' : '❌'}`);
  console.log(`  HeyGen: ${checks.heygen_submit ? '✅' : '❌'}`);
  console.log(`  Pipeline: ${checks.openai && checks.heygen_submit ? '🟢 READY' : '🔴 NOT READY'}`);
  console.log('═══════════════════════════════════════\n');

  return checks;
}

testCycle()
  .then(r => process.exit(r.openai && r.heygen_submit ? 0 : 1))
  .catch(e => { console.error('FATAL:', e); process.exit(1); });
