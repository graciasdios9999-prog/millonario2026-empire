/**
 * Central configuration - SECURITY FIRST
 * All secrets MUST come from process.env / GitHub Secrets / deployment environment.
 * Never hardcode tokens, keys or passwords.
 *
 * Usage:
 *   const config = require('./config');
 *   // or const { getConfig } = require('./config');
 */

'use strict';

function required(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === '') {
    return null;
  }
  return value;
}

function optional(name, defaultValue = '') {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return value;
}

/**
 * Returns a frozen config object.
 * Throws only for truly critical missing values if called with { strict: true }.
 */
function getConfig(options = {}) {
  const strict = options.strict === true;

  const config = {
    // Shopify
    SHOPIFY_SHOP_1: optional('SHOPIFY_SHOP_1'),
    SHOPIFY_SHOP_2: optional('SHOPIFY_SHOP_2'),
    SHOPIFY_ACCESS_TOKEN: required('SHOPIFY_ACCESS_TOKEN'),
    SHOPIFY_API_VERSION: optional('SHOPIFY_API_VERSION', '2025-01'),

    // WhatsApp
    WHATSAPP_ACCESS_TOKEN: required('WHATSAPP_ACCESS_TOKEN'),
    WHATSAPP_PHONE_NUMBER_ID: required('WHATSAPP_PHONE_NUMBER_ID'),
    ADMIN_WHATSAPP_NUMBER: optional('ADMIN_WHATSAPP_NUMBER'),
    WHATSAPP_VERIFY_TOKEN: optional('WHATSAPP_VERIFY_TOKEN', 'empire-verify-token'),

    // OpenAI / AI
    OPENAI_API_KEY: required('OPENAI_API_KEY'),

    // Other common
    HEYGEN_API_KEY: optional('HEYGEN_API_KEY'),
    HUBSPOT_API_KEY: optional('HUBSPOT_API_KEY'),
    ALPACA_API_KEY: optional('ALPACA_API_KEY'),
    ALPACA_SECRET_KEY: optional('ALPACA_SECRET_KEY'),
    FACEBOOK_PAGE_TOKEN: optional('FACEBOOK_PAGE_TOKEN'),
    ZAPIER_WEBHOOK_URL: optional('ZAPIER_WEBHOOK_URL'),

    // Trigger protection
    TRIGGER_SECRET: optional('TRIGGER_SECRET'),

    // Runtime
    NODE_ENV: optional('NODE_ENV', 'development'),
    PORT: optional('PORT', '3000'),
  };

  if (strict) {
    const missing = [];
    if (!config.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  return Object.freeze(config);
}

const config = getConfig({ strict: false });

module.exports = config;
module.exports.getConfig = getConfig;
module.exports.default = config;
