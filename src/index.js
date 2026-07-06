/**
 * CEO-DIOS EMPIRE V12 - Entry Point
 * Express server + cron fallback for non-GitHub-Actions environments
 */

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { masterLoop } = require('./master-loop');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'CEO-Dios Empire V12',
    status: 'operational',
    version: '12.0.0',
    mode: 'HEYGEN_VIDEO_ONLY',
    platforms: { youtube: 'Midlife Reset Lab', facebook: 'Patria y Vida' },
    uptime: process.uptime(),
    lastRun: global.lastRun || null,
  });
});

app.post('/trigger', async (req, res) => {
  try {
    const results = await masterLoop();
    global.lastRun = new Date().toISOString();
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/status', (req, res) => {
  res.json({
    status: 'alive',
    version: '12.0.0',
    modules: {
      heygen: !!process.env.HEYGEN_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      youtube: !!process.env.YOUTUBE_REFRESH_TOKEN,
      facebook: !!process.env.FACEBOOK_PAGE_TOKEN,
      trading: !!process.env.ALPACA_API_KEY,
    },
    lastRun: global.lastRun || 'never',
  });
});

// Fallback cron: every 3.5 hours (7x/day)
cron.schedule('0 0,3,7,10,14,17,21 * * *', async () => {
  console.log('[CRON] V12 Master Loop triggering...');
  try {
    await masterLoop();
    global.lastRun = new Date().toISOString();
  } catch (e) {
    console.error('[CRON] Failed:', e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Empire V12 server running on port ${PORT}`);
  console.log('Mode: HeyGen Video-Only | 7x/day');
});
