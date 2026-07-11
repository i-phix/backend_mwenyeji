/**
 * Integration test for the agent-side recipient-group endpoints.
 *
 * What this tests (end-to-end, against your local MongoDB):
 *   1. POST  /api/customer_obsession/recipient-groups                   create
 *   2. GET   /api/customer_obsession/recipient-groups                   list
 *   3. GET   /api/customer_obsession/recipient-groups/:id               read
 *   4. PUT   /api/customer_obsession/recipient-groups/:id               update
 *   5. POST  /api/customer_obsession/recipient-groups/:id/members       add members
 *   6. GET   /api/customer_obsession/recipient-groups/:id (after add)   member count
 *   7. DELETE /api/customer_obsession/recipient-groups/:groupId/members/:memberId
 *   8. POST  duplicate group name                                       409 expected
 *   9. POST  members beyond cap                                         400 expected
 *  10. DELETE group (cascades members)                                  cleanup
 *
 * It uses Fastify's `inject()` API — no port, no curl, no separate server.
 * Mints an AGENTUSER JWT in-process with the same `jwtSecret` the running
 * server uses, so the JWT middleware accepts it.
 *
 * Run:
 *   cd payserve_backend
 *   node scripts/test_agent_groups.js
 *
 * Requires env vars: jwtSecret  (and Mongo running on 127.0.0.1:27017 with
 * the credentials hardcoded in app.js).
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const payservedb = require('payservedb');

const JWT_SECRET = process.env.jwtSecret;
if (!JWT_SECRET) {
  console.error('jwtSecret env var is required (matches your running server)');
  process.exit(1);
}

const TEST_AGENT_USER_ID = new mongoose.Types.ObjectId();
const TEST_GROUP_NAME = `__integration_test_${Date.now()}`;

function mintAgentToken() {
  return jwt.sign(
    {
      userId: TEST_AGENT_USER_ID.toString(),
      type: 'Customer_Support',
      email: 'integration-test@payserve.co.ke',
      fullName: 'Integration Test',
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

const PASS = '[32mPASS[0m';
const FAIL = '[31mFAIL[0m';

let passed = 0;
let failed = 0;

function assertEq(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ${PASS}  ${name} → ${JSON.stringify(actual)}`);
    passed += 1;
  } else {
    console.log(`  ${FAIL}  ${name} → got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
    failed += 1;
  }
}

function assertTruthy(name, val) {
  if (val) {
    console.log(`  ${PASS}  ${name}`);
    passed += 1;
  } else {
    console.log(`  ${FAIL}  ${name} → ${JSON.stringify(val)}`);
    failed += 1;
  }
}

async function main() {
  // ── DB connect (same params as app.js) ─────────────────────────────────
  await payservedb.connectToMongoDB(
    'payserve_property',
    true,
    'Ps',
    'Letmein987',
    '127.0.0.1',
    '27017',
  );

  // ── Boot Fastify with the customer_obsession route module ──────────────
  const fastify = require('fastify')({ logger: false });
  const co = require('../src/routes/customer_obsession');
  await co.registerRoutes(fastify);
  await fastify.ready();

  const headers = authHeader(mintAgentToken());
  const base = '/api/customer_obsession/recipient-groups';

  let createdGroupId = null;
  let memberAId = null;

  try {
    // ── 1. Create group ──────────────────────────────────────────────────
    console.log('\n[1] POST create group');
    {
      const r = await fastify.inject({
        method: 'POST',
        url: base,
        headers,
        payload: {
          name: TEST_GROUP_NAME,
          channel: 'email',
          description: 'created by integration test',
        },
      });
      const body = r.json();
      assertEq("status", r.statusCode, 200);
      assertEq('success', body.success, true);
      assertTruthy('data._id', body.data?._id);
      assertEq('data.name', body.data?.name, TEST_GROUP_NAME);
      assertEq('data.channel', body.data?.channel, 'email');
      assertEq('data.member_count', body.data?.member_count, 0);
      createdGroupId = body.data?._id;
    }
    if (!createdGroupId) throw new Error('No group id — aborting subsequent steps');

    // ── 2. List groups ───────────────────────────────────────────────────
    console.log('\n[2] GET list groups');
    {
      const r = await fastify.inject({ method: 'GET', url: base, headers });
      const body = r.json();
      assertEq('status', r.statusCode, 200);
      assertEq('success', body.success, true);
      const found = (body.data || []).find((g) => String(g._id) === String(createdGroupId));
      assertTruthy('test group present in list', found);
    }

    // ── 3. Read single group ─────────────────────────────────────────────
    console.log('\n[3] GET read group');
    {
      const r = await fastify.inject({
        method: 'GET',
        url: `${base}/${createdGroupId}`,
        headers,
      });
      const body = r.json();
      assertEq('status', r.statusCode, 200);
      assertEq('success', body.success, true);
      assertEq('members empty', (body.data?.members || []).length, 0);
    }

    // ── 4. Update group ──────────────────────────────────────────────────
    console.log('\n[4] PUT update group description');
    {
      const r = await fastify.inject({
        method: 'PUT',
        url: `${base}/${createdGroupId}`,
        headers,
        payload: { description: 'updated by integration test' },
      });
      const body = r.json();
      assertEq('status', r.statusCode, 200);
      assertEq('success', body.success, true);
      assertEq('updated description', body.data?.description, 'updated by integration test');
    }

    // ── 5. Add members ───────────────────────────────────────────────────
    console.log('\n[5] POST add members (2 free-form emails)');
    {
      const r = await fastify.inject({
        method: 'POST',
        url: `${base}/${createdGroupId}/members`,
        headers,
        payload: {
          members: [
            { name: 'Alice', email: 'alice@example.com' },
            { name: 'Bob', email: 'bob@example.com' },
          ],
        },
      });
      const body = r.json();
      // Server returns 200 for add-to-existing-resource semantics. Members are
      // a sub-collection of an existing group, not a top-level new resource.
      assertEq('status', r.statusCode, 200);
      assertEq('success', body.success, true);
      assertEq('added count', body.data?.added, 2);
      memberAId = body.data?.members?.[0]?._id;
      assertTruthy('member A id returned', memberAId);
    }

    // ── 5b. Read group again — member_count should be 2 ──────────────────
    console.log('\n[5b] GET group → member_count = 2');
    {
      const r = await fastify.inject({
        method: 'GET',
        url: `${base}/${createdGroupId}`,
        headers,
      });
      const body = r.json();
      assertEq('member_count', body.data?.member_count, 2);
      assertEq('members.length', (body.data?.members || []).length, 2);
    }

    // ── 6. Add a duplicate email — should be reported as skipped ─────────
    console.log('\n[6] POST duplicate email member → skipped, not added');
    {
      const r = await fastify.inject({
        method: 'POST',
        url: `${base}/${createdGroupId}/members`,
        headers,
        payload: { members: [{ name: 'Alice again', email: 'alice@example.com' }] },
      });
      const body = r.json();
      assertEq('status', r.statusCode, 200);
      assertEq('added', body.data?.added, 0);
      assertEq('skipped', body.data?.skipped, 1);
    }

    // ── 7. Remove one member ─────────────────────────────────────────────
    console.log('\n[7] DELETE one member');
    {
      const r = await fastify.inject({
        method: 'DELETE',
        url: `${base}/${createdGroupId}/members/${memberAId}`,
        headers,
      });
      const body = r.json();
      assertEq('status', r.statusCode, 200);
      assertEq('success', body.success, true);
    }
    console.log('\n[7b] GET group → member_count = 1');
    {
      const r = await fastify.inject({
        method: 'GET',
        url: `${base}/${createdGroupId}`,
        headers,
      });
      const body = r.json();
      assertEq('member_count', body.data?.member_count, 1);
    }

    // ── 8. Duplicate-name guard ─────────────────────────────────────────
    console.log('\n[8] POST duplicate group name → 409');
    {
      const r = await fastify.inject({
        method: 'POST',
        url: base,
        headers,
        payload: { name: TEST_GROUP_NAME, channel: 'email' },
      });
      assertEq('status', r.statusCode, 409);
    }

    // ── 9. GET config (cap) ─────────────────────────────────────────────
    console.log('\n[9] GET config');
    {
      const r = await fastify.inject({
        method: 'GET',
        url: `${base}/config`,
        headers,
      });
      const body = r.json();
      assertEq('status', r.statusCode, 200);
      assertEq('success', body.success, true);
      assertTruthy('max_members_per_group is a positive int',
        Number.isInteger(body.data?.max_members_per_group) && body.data.max_members_per_group > 0);
    }

    // ── 10. Unauthenticated request → 401 ────────────────────────────────
    console.log('\n[10] No auth header → 401');
    {
      const r = await fastify.inject({ method: 'GET', url: base });
      assertEq('status', r.statusCode, 401);
    }

    // ── 11. Cleanup — delete the test group, members cascade ─────────────
    console.log('\n[11] DELETE group (cleanup)');
    {
      const r = await fastify.inject({
        method: 'DELETE',
        url: `${base}/${createdGroupId}`,
        headers,
      });
      const body = r.json();
      assertEq('status', r.statusCode, 200);
      assertEq('success', body.success, true);
    }
    console.log('\n[11b] GET deleted group → 404');
    {
      const r = await fastify.inject({
        method: 'GET',
        url: `${base}/${createdGroupId}`,
        headers,
      });
      assertEq('status', r.statusCode, 404);
    }
    // And confirm the orphaned members are gone too
    {
      const remaining = await payservedb.RecipientGroupMember.countDocuments({
        group_id: createdGroupId,
      });
      assertEq('orphan members deleted', remaining, 0);
    }
  } finally {
    // Belt and braces — clean up even if a test threw
    if (createdGroupId) {
      try { await payservedb.RecipientGroup.findByIdAndDelete(createdGroupId); } catch (_) {}
      try { await payservedb.RecipientGroupMember.deleteMany({ group_id: createdGroupId }); } catch (_) {}
    }
    await fastify.close();
    await mongoose.disconnect();
  }

  console.log(`\n──────────────────────────────────`);
  console.log(`  passed: ${passed}    failed: ${failed}`);
  console.log(`──────────────────────────────────`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Integration test errored:', err);
  process.exit(2);
});
