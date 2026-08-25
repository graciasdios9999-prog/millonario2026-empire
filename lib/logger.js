/**
 * Structured logger — never log secrets.
 */
'use strict';

function safeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  const blocked = /token|secret|password|authorization|api[_-]?key|credential/i;
  for (const [k, v] of Object.entries(meta)) {
    if (blocked.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string' && /^(EAA|sk-|ghp_|github_pat_)/.test(v)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function log(level, operation, status, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    operation,
    status,
    ...safeMeta(meta || {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else console.log(line);
  return entry;
}

module.exports = {
  info: (op, status, meta) => log('info', op, status, meta),
  warn: (op, status, meta) => log('warn', op, status, meta),
  error: (op, status, meta) => log('error', op, status, meta),
  success: (op, meta) => log('info', op, 'SUCCESS', meta),
  failed: (op, meta) => log('error', op, 'FAILED', meta),
  estimated: (op, meta) => log('info', op, 'ESTIMATED', meta),
  verified: (op, meta) => log('info', op, 'VERIFIED', meta),
  blocked: (op, meta) => log('warn', op, 'BLOCKED', meta),
};
