/**
 * Lead capture with idempotency by email.
 */
'use strict';

const store = require('./store');
const logger = require('./logger');
const analytics = require('./analytics');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function captureLead(input) {
  const email = normalizeEmail(input && input.email);
  if (!email || !email.includes('@')) {
    return { status: 'FAILED', error: 'invalid_email' };
  }
  const state = store.load();
  if (!state.leads) state.leads = {};
  const existing = state.leads[email];
  if (existing) {
    logger.info('leads.capture', 'SUCCESS', { duplicate: true, email_hash: email.slice(0, 3) + '***' });
    return { status: 'SUCCESS', duplicate: true, lead: existing };
  }
  const lead = {
    email,
    source: (input && input.source) || 'unknown',
    campaign: (input && input.campaign) || null,
    product_interest: (input && input.product_interest) || null,
    status: 'lead',
    created_at: new Date().toISOString(),
  };
  state.leads[email] = lead;
  store.save(state);
  analytics.track('lead_captured', { source: lead.source });
  logger.success('leads.capture', { source: lead.source });
  return { status: 'SUCCESS', duplicate: false, lead };
}

function listLeads() {
  const state = store.load();
  return Object.values(state.leads || {});
}

module.exports = { captureLead, listLeads, normalizeEmail };
