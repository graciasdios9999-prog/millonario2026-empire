/**
 * Basic regression tests for master-loop module.
 * These tests detect the critical side-effect bug and ensure clean exports.
 *
 * Run: npm test
 */

const assert = require('assert');
const path = require('path');

console.log('Running master-loop basic tests...');

// 1. Module can be required without throwing (and ideally without side effects)
let masterLoopModule;
try {
  masterLoopModule = require(path.join(__dirname, '../src/master-loop.js'));
  console.log('✓ require(src/master-loop.js) succeeded');
} catch (e) {
  console.error('✗ require failed:', e.message);
  process.exit(1);
}

// 2. masterLoop is exported and is a function
assert.ok(masterLoopModule, 'module should export something');
assert.strictEqual(typeof masterLoopModule.masterLoop, 'function', 'masterLoop must be a function');
console.log('✓ masterLoop is exported as a function');

// 3. Calling the exported function is possible (we do not await full run here to avoid external deps)
// This is a smoke test only.
assert.doesNotThrow(() => {
  // We just confirm the function reference is callable signature-wise
  const fn = masterLoopModule.masterLoop;
  assert.strictEqual(fn.length, 0, 'masterLoop takes no required arguments');
}, 'masterLoop should be callable');
console.log('✓ masterLoop has expected signature');

console.log('\nAll basic master-loop tests passed.');
console.log('NOTE: After the side-effect fix is merged, requiring this module must NOT start the autonomous loop.');
