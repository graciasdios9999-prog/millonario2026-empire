const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const axios = require('axios');

// SECURITY: credentials only from environment / secrets. Never hardcode tokens.
const CREDENTIALS = {
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  ADMIN_WHATSAPP_NUMBER: process.env.ADMIN_WHATSAPP_NUMBER || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
};

let Database = null;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = null;
}

const DB_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) {
  try { fs.mkdirSync(DB_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}
const DB_PATH = path.join(DB_DIR, 'millonario_v20_god.db');

let db = null;
if (Database) {
  try {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS learnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT, content TEXT, source TEXT, learned TEXT, confidence INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS self_study_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT, results_summary TEXT, actions_triggered TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, description TEXT, result TEXT, money_impact REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('[selfStudyAgent] SQLite unavailable:', e.message);
    db = null;
  }
}

const openai = CREDENTIALS.OPENAI_API_KEY
  ? new OpenAI({ apiKey: CREDENTIALS.OPENAI_API_KEY })
  : null;

const STUDY_TOPICS = [
  'tendencias reset salud 2026-2030',
  'estrategias Shopify e-commerce',
  'AI en comercio y educacion',
  'predicciones mercado trading 2026-2030',
  'contenido educativo recurrente',
  'retencion challenges y experiencias',
  'e-commerce autonomo agentes IA',
  'video IA y monetizacion afiliados'
];

async function autonomousSelfStudy() {
  console.log('[SELF-STUDY] starting');
  if (!openai) {
    console.warn('[SELF-STUDY] OPENAI_API_KEY missing - skipped');
    return { studied: [], learned: [], executed: [], totalMoneyImpact: 0 };
  }

  const today = new Date().toISOString().split('T')[0];
  let studied = [];
  let learned = [];
  let executed = [];
  let totalMoneyImpact = 0;

  for (const topic of STUDY_TOPICS) {
    try {
      const prompt = `Study topic: "${topic}". Return ONLY valid JSON: {"keyInsight":"...","futurePrediction":"...","actionToExecute":"...","moneyPotential":number,"confidence":0-100}. moneyPotential is ESTIMATED only, not verified sales.`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      });

      let aiResponse;
      try {
        aiResponse = JSON.parse(completion.choices[0].message.content.trim());
      } catch (e) {
        aiResponse = {
          keyInsight: completion.choices[0].message.content.substring(0, 300),
          futurePrediction: 'AI agents expand',
          actionToExecute: 'Optimize education campaigns',
          moneyPotential: 0,
          confidence: 50
        };
      }

      if (db) {
        try {
          db.prepare('INSERT INTO learnings (topic, content, source, learned, confidence) VALUES (?, ?, ?, ?, ?)')
            .run(topic, aiResponse.keyInsight, 'v20_ai', aiResponse.futurePrediction, aiResponse.confidence || 0);
        } catch (_) {}
      }

      studied.push(topic);
      learned.push(aiResponse.keyInsight);

      const actionResult = await executeGodAction(aiResponse.actionToExecute, aiResponse.moneyPotential, topic);
      executed.push(actionResult.description);
      totalMoneyImpact += actionResult.money;

      if (db) {
        try {
          db.prepare('INSERT INTO self_study_log (query, results_summary, actions_triggered) VALUES (?, ?, ?)')
            .run(topic, aiResponse.keyInsight, actionResult.description);
        } catch (_) {}
      }
    } catch (err) {
      console.error('[SELF-STUDY] topic error', topic, err.message);
    }
  }

  console.log('[SELF-STUDY] done. ESTIMATED revenue USD $' + totalMoneyImpact + ' (NOT verified sales)');
  return { studied, learned, executed, totalMoneyImpact };
}

async function executeGodAction(action, moneyPotential, topic) {
  // SIMULATION / ESTIMATION only: does NOT create Shopify products, charge customers, or place trades.
  let description = action || 'plan';
  let money = Number(moneyPotential) || 0;

  if (String(action).toLowerCase().includes('shopify') || String(action).toLowerCase().includes('bundle')) {
    description = 'ESTIMATED Shopify plan based on ' + topic + ' (not executed write)';
  } else if (String(action).toLowerCase().includes('trading')) {
    description = 'ESTIMATED trading signal plan (not executed order) for ' + topic;
  } else {
    description = 'ESTIMATED action plan (not verified sale): ' + action;
  }

  if (db) {
    try {
      db.prepare('INSERT INTO actions (type, description, result, money_impact) VALUES (?, ?, ?, ?)')
        .run('v20_ai_action_estimated', description, action, money);
    } catch (_) {}
  }

  return { description, money, moneyType: 'ESTIMATED' };
}

module.exports = { autonomousSelfStudy };
