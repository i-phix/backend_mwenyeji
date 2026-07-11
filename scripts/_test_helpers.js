/**
 * Shared helpers for the integration test scripts in this directory.
 *
 * Pattern each script follows:
 *   const h = require('./_test_helpers');
 *   await h.connect();
 *   const fastify = await h.bootFastify({ routes: [...] });
 *   const headers = h.adminAuth();    // or h.agentAuth()
 *   // run assertions with h.assertEq / h.assertTruthy
 *   await h.shutdown(fastify);
 *   h.exitWithSummary();
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const payservedb = require('payservedb');

const JWT_SECRET = process.env.jwtSecret;
if (!JWT_SECRET) {
  console.error('jwtSecret env var is required (must match running server)');
  process.exit(1);
}

const TEST_USER_ID = new mongoose.Types.ObjectId();

function mintToken(extra = {}) {
  return jwt.sign(
    { userId: TEST_USER_ID.toString(), email: 'integration-test@payserve.co.ke', ...extra },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function adminAuth() {
  // Admin tokens come from core_main login; type 'Core' / 'Universal' etc.
  // JWT middleware doesn't gate on type, only on signature validity.
  return { authorization: `Bearer ${mintToken({ type: 'Core', fullName: 'Test Admin' })}` };
}

function agentAuth() {
  return { authorization: `Bearer ${mintToken({ type: 'Customer_Support', fullName: 'Test Agent' })}` };
}

const PASS = '[32mPASS[0m';
const FAIL = '[31mFAIL[0m';

const state = { passed: 0, failed: 0, name: '' };

function setSuite(name) {
  state.name = name;
  state.passed = 0;
  state.failed = 0;
  console.log(`\n=== ${name} ===`);
}

function assertEq(label, actual, expected) {
  if (Object.is(actual, expected)) {
    console.log(`  ${PASS}  ${label} → ${JSON.stringify(actual)}`);
    state.passed += 1;
  } else {
    console.log(`  ${FAIL}  ${label} → got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
    state.failed += 1;
  }
}

function assertTruthy(label, val) {
  if (val) {
    console.log(`  ${PASS}  ${label}`);
    state.passed += 1;
  } else {
    console.log(`  ${FAIL}  ${label} → ${JSON.stringify(val)}`);
    state.failed += 1;
  }
}

function step(label) {
  console.log(`\n[${label}]`);
}

async function connect() {
  await payservedb.connectToMongoDB(
    'payserve_property',
    true,
    'Ps',
    'Letmein987',
    '127.0.0.1',
    '27017',
  );
}

async function bootFastify({ routes }) {
  const fastify = require('fastify')({ logger: false });
  for (const r of routes) {
    await r.registerRoutes(fastify);
  }
  await fastify.ready();
  return fastify;
}

async function shutdown(fastify) {
  try { if (fastify) await fastify.close(); } catch (_) {}
  try { await mongoose.disconnect(); } catch (_) {}
}

function exitWithSummary() {
  console.log(`\n──────────────────────────────────`);
  console.log(`  ${state.name}: passed ${state.passed} · failed ${state.failed}`);
  console.log(`──────────────────────────────────`);
  process.exit(state.failed > 0 ? 1 : 0);
}

module.exports = {
  TEST_USER_ID,
  mintToken,
  adminAuth,
  agentAuth,
  setSuite,
  step,
  assertEq,
  assertTruthy,
  connect,
  bootFastify,
  shutdown,
  exitWithSummary,
};
