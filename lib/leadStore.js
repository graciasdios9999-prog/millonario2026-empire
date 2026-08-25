/**
 * Lead capture store — deduped by email.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../data');
const LEADS_PATH = path.join(DATA_DIR, 'leads.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
}

function load() {
  ensure();
  try {
    if (fs.existsSync(LEADS_PATH)) return JSON.parse(fs.readFileSync(LEADS_PATH, 'utf8'));
  } catch (e) {
    logger.warn('leads.load', 'FAILED', { error: e.message });
  }
  return { leads: {} };
}

function save(state) {
  ensure();
  const tmp = LEADS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, LEADS_PATH);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function captureLead(input) {
  const email = normalizeEmail(input && input.email);
  if (!email || !email.includes('@')) {
    return { status: 'FAILED', error: 'invalid_email' };
  }
  const state = load();
  if (state.leads[email]) {
    logger.info('leads.capture', 'SUCCESS', { email_domain: email.split('@')[1], duplicate: true });
    return { status: 'SUCCESS', duplicate: true, lead: state.leads[email] };
  }
  const lead = {
    email,
    source: (input && input.source) || 'unknown',
    campaign: (input && input.campaign) || null,
    productInterest: (input && input.productInterest) || null,
    status: 'lead',
    created_at: new Date().toISOString(),
    converted: false,
  };
  state.leads[email] = lead;
  save(state);
  logger.info('leads.capture', 'SUCCESS', { email_domain: email.split('@')[1], duplicate: false });
  return { status: 'SUCCESS', duplicate: false, lead };
}

function listLeads() {
  return Object.values(load().leads);
}

function count() {
  return Object.keys(load().leads).length;
}

module.exports = { captureLead, listLeads, count };
