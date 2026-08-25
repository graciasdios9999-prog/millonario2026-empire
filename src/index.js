/**
 * CEO-DIOS EMPIRE V20 GOD LEVEL - Entry Point
 * Express server + cron fallback for non-GitHub-Actions environments
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { masterLoop } = require('./master-loop');

const app = express();
const PORT = process.env.PORT || 3000;
const TRIGGER_SECRET = process.env.TRIGGER_SECRET || '';

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    name: 'CEO-Dios Empire V20 God Level',
    status: 'operational',
    version: '20.0.0',
    mode: 'FULL_AUTONOMOUS_EMPIRE',
    platforms: { youtube: 'Midlife Reset Lab', facebook: 'Patria y Vida' },
    uptime: process.uptime(),
    lastRun: global.lastRun || null,
  });
});

/**
 * Protected trigger endpoint.
 * Require header: X-Trigger-Secret: <TRIGGER_SECRET>
 * If TRIGGER_SECRET is empty, endpoint rejects all calls (fail-closed).
 */
app.post('/trigger', async (req, res) => {
  const provided =
    req.get('X-Trigger-Secret') ||
    req.get('x-trigger-secret') ||
    (req.body && req.body.secret) ||
    req.query.secret ||
    '';

  if (!TRIGGER_SECRET) {
    console.warn('[SECURITY] /trigger called but TRIGGER_SECRET is not configured - rejecting');
    return res.status(403).json({
      success: false,
      error: 'Trigger endpoint is disabled until TRIGGER_SECRET is set in environment'
    });
  }

  if (provided !== TRIGGER_SECRET) {
    console.warn('[SECURITY] Invalid trigger secret attempt');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const results = await masterLoop();
    global.lastRun = new Date().toISOString();
    res.json({ success: true, results });
  } catch (e) {
    console.error('[TRIGGER] Failed:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/status', (req, res) => {
  res.json({
    status: 'alive',
    version: '20.0.0',
    modules: {
      heygen: !!process.env.HEYGEN_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      youtube: !!process.env.YOUTUBE_REFRESH_TOKEN,
      facebook: !!process.env.FACEBOOK_PAGE_TOKEN,
      trading: !!process.env.ALPACA_API_KEY,
      whatsapp: !!process.env.WHATSAPP_ACCESS_TOKEN,
    },
    lastRun: global.lastRun || 'never',
  });
});

// Fallback cron: only active if ENABLE_INTERNAL_CRON=true
// PRIMARY scheduler is GitHub Actions. This is a true fallback.
if (process.env.ENABLE_INTERNAL_CRON === 'true') {
  cron.schedule('0 0,3,7,10,14,17,21 * * *', async () => {
    console.log('[CRON FALLBACK] V20 Master Loop triggering...');
    try {
      await masterLoop();
      global.lastRun = new Date().toISOString();
    } catch (e) {
      console.error('[CRON FALLBACK] Failed:', e.message);
    }
  });
  console.log('[CRON] Internal fallback cron ENABLED (ENABLE_INTERNAL_CRON=true)');
} else {
  console.log('[CRON] Internal fallback cron DISABLED (set ENABLE_INTERNAL_CRON=true to enable)');
}

app.listen(PORT, () => {
  console.log(`Empire V20 God Level server running on port ${PORT}`);
  console.log('Mode: Full Autonomous Empire | PRIMARY scheduler = GitHub Actions');
});
