// lib/db.js - Súper Base de Datos v20 God Level
// SQLite portable para learnings, videos, knowledge, actions, daily reports
// Auto-crea y se auto-mejora

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../data/millonario_v20_god.db');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS learnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT (datetime('now')),
    topic TEXT,
    content TEXT,
    source TEXT,
    learned TEXT,
    confidence INTEGER DEFAULT 80
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT (datetime('now')),
    title TEXT,
    description TEXT,
    url TEXT,
    type TEXT,
    metadata TEXT,
    status TEXT DEFAULT 'stored'
  );

  CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    key TEXT UNIQUE,
    value TEXT,
    last_updated TEXT DEFAULT (datetime('now')),
    usage_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT (datetime('now')),
    type TEXT,
    description TEXT,
    result TEXT,
    money_impact REAL DEFAULT 0,
    status TEXT DEFAULT 'executed'
  );

  CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE,
    studied TEXT,
    learned TEXT,
    executed TEXT,
    money_generated REAL DEFAULT 0,
    insights TEXT
  );

  CREATE TABLE IF NOT EXISTS self_study_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT (datetime('now')),
    query TEXT,
    results_summary TEXT,
    actions_triggered TEXT
  );
`);

console.log('✅ v20 God DB inicializada:', DB_PATH);

export function saveLearning(topic, content, source = 'autonomous', learned = '', confidence = 80) {
  const stmt = db.prepare(`INSERT INTO learnings (topic, content, source, learned, confidence) VALUES (?, ?, ?, ?, ?)`);
  return stmt.run(topic, content, source, learned, confidence);
}

export function saveVideo(title, description, url, type = 'educational', metadata = '{}') {
  const stmt = db.prepare(`INSERT INTO videos (title, description, url, type, metadata) VALUES (?, ?, ?, ?, ?)`);
  return stmt.run(title, description, url, type, metadata);
}

export function saveAction(type, description, result = '', moneyImpact = 0) {
  const stmt = db.prepare(`INSERT INTO actions (type, description, result, money_impact) VALUES (?, ?, ?, ?)`);
  return stmt.run(type, description, result, moneyImpact);
}

export function saveDailyReport(date, studied, learned, executed, money = 0, insights = '') {
  const stmt = db.prepare(`INSERT OR REPLACE INTO daily_reports (date, studied, learned, executed, money_generated, insights) VALUES (?, ?, ?, ?, ?, ?)`);
  return stmt.run(date, studied, learned, executed, money, insights);
}

export function getRecentLearnings(limit = 5) {
  return db.prepare('SELECT * FROM learnings ORDER BY date DESC LIMIT ?').all(limit);
}

export function logSelfStudy(query, resultsSummary, actionsTriggered) {
  const stmt = db.prepare(`INSERT INTO self_study_log (query, results_summary, actions_triggered) VALUES (?, ?, ?)`);
  return stmt.run(query, resultsSummary, actionsTriggered);
}

export default db;