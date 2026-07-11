/**
 * Integration test for the bulk send endpoint (PR5).
 *
 * Stubs the outbound transports BEFORE requiring the route module so the test
 * doesn't actually send real email or WhatsApp:
 *   - nodemailer.createTransport returns a stub whose sendMail resolves with
 *     a synthetic messageId, never touching SMTP.
 *   - axios.post is intercepted; URLs matching Green API / Meta WA send paths
 *     return a stub response; all other URLs fall through to the real axios.
 *
 * Tests:
 *   - happy path: 2-member email group → sent=2, failed=0
 *   - validation: missing body / subject / channel mismatch / unknown group
 *   - WhatsApp happy path: 1-member group → sent=1, failed=0
 *   - per-recipient failure isolation: 1 valid + 1 with no email → 1 sent + 1 (excluded by validator)
 *
 * Run:  cd payserve_backend && node scripts/test_bulk_send.js
 */

// ─── 1. STUB TRANSPORTS BEFORE ANY REQUIRE THAT MIGHT PULL bulk_send ────────
const nodemailer = require('nodemailer');
nodemailer.createTransport = () => ({
  sendMail: async (opts) => ({
    messageId: `<stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@stub.local>`,
    accepted: [opts.to],
  }),
});

const axios = require('axios');
const realPost = axios.post.bind(axios);
axios.post = async (url, data, opts) => {
  // Green API send path
  if (/\/sendMessage\//i.test(url)) {
    return { data: { idMessage: `stub-wa-${Date.now()}` } };
  }
  // Meta WhatsApp send path
  if (/\/messages$/i.test(url) && url.includes('/whatsapp')) {
    return { data: { messages: [{ id: `stub-meta-${Date.now()}` }] } };
  }
  return realPost(url, data, opts);
};

// Make sure Green API config is set so the sender doesn't throw on missing env.
process.env.GREEN_API_URL = process.env.GREEN_API_URL || 'https://api.green-api.example.test';
process.env.GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE || '1234567890';
process.env.GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || 'stub-token';

// ─── 2. NOW we can safely require the rest ──────────────────────────────────
const payservedb = require('payservedb');
const mongoose = require('mongoose');
const h = require('./_test_helpers');

async function createGroupWithMembers({ name, channel, members }) {
  const group = await payservedb.RecipientGroup.create({
    name,
    channel,
    description: 'bulk send integration test',
    member_count: 0,
  });
  if (members.length) {
    await payservedb.RecipientGroupMember.insertMany(
      members.map((m) => ({ ...m, group_id: group._id })),
    );
    await payservedb.RecipientGroup.findByIdAndUpdate(group._id, {
      $set: { member_count: members.length },
    });
  }
  return group;
}

async function deleteGroupCascade(groupId) {
  if (!groupId) return;
  try { await payservedb.RecipientGroup.findByIdAndDelete(groupId); } catch (_) {}
  try { await payservedb.RecipientGroupMember.deleteMany({ group_id: groupId }); } catch (_) {}
}

async function main() {
  h.setSuite('BulkSend');
  await h.connect();

  // Pre-cleanup
  await payservedb.RecipientGroup.deleteMany({ name: { $regex: '^__bulk_test_' } });

  const fastify = await h.bootFastify({
    routes: [require('../src/routes/customer_obsession')],
  });

  const url = '/api/customer_obsession/bulk-send';
  const headers = h.agentAuth();

  const emailGroup = await createGroupWithMembers({
    name: `__bulk_test_email_${Date.now()}`,
    channel: 'email',
    members: [
      { name: 'Alice', email: 'alice@example.test' },
      { name: 'Bob', email: 'bob@example.test' },
    ],
  });
  const waGroup = await createGroupWithMembers({
    name: `__bulk_test_wa_${Date.now()}`,
    channel: 'whatsapp',
    members: [
      { name: 'Charlie', phone: '+254700000001' },
    ],
  });
  const mixedGroup = await createGroupWithMembers({
    name: `__bulk_test_mix_${Date.now()}`,
    channel: 'email',
    members: [
      { name: 'Dana', email: 'dana@example.test' },
      // missing email — should be filtered out by dedupeRecipients
      { name: 'NoEmail', phone: '+254700000099' },
    ],
  });

  try {
    // 1. happy path email
    h.step('1] POST email bulk-send → sent=2, failed=0');
    {
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: {
          group_id: emailGroup._id.toString(),
          channel: 'email',
          subject: 'Integration test',
          body: 'Hello from integration test',
        },
      });
      const body = r.json();
      h.assertEq('status', r.statusCode, 200);
      h.assertEq('success', body.success, true);
      h.assertEq('total', body.data?.total, 2);
      h.assertEq('sent', body.data?.sent, 2);
      h.assertEq('failed', body.data?.failed, 0);
      h.assertEq('results length', body.data?.results?.length, 2);
      h.assertTruthy('every result success', (body.data?.results || []).every((r) => r.success));
    }

    // 2. missing body → 400
    h.step('2] POST without body → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: { group_id: emailGroup._id.toString(), channel: 'email', subject: 'x' },
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 3. missing subject (email) → 400
    h.step('3] POST email without subject → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: { group_id: emailGroup._id.toString(), channel: 'email', body: 'x' },
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 4. invalid channel → 400
    h.step('4] POST with invalid channel → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: { group_id: emailGroup._id.toString(), channel: 'sms', body: 'x' },
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 5. unknown group → 404
    h.step('5] POST with unknown group_id → 404');
    {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: { group_id: fakeId, channel: 'email', subject: 'x', body: 'x' },
      });
      h.assertEq('status', r.statusCode, 404);
    }

    // 6. channel mismatch → 400 (email group, whatsapp request)
    h.step('6] POST channel mismatch (email group, whatsapp request) → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: { group_id: emailGroup._id.toString(), channel: 'whatsapp', body: 'x' },
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 7. whatsapp happy path
    h.step('7] POST WhatsApp bulk-send → sent=1');
    {
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: { group_id: waGroup._id.toString(), channel: 'whatsapp', body: 'Hi via WA' },
      });
      const body = r.json();
      h.assertEq('status', r.statusCode, 200);
      h.assertEq('total', body.data?.total, 1);
      h.assertEq('sent', body.data?.sent, 1);
      h.assertEq('failed', body.data?.failed, 0);
    }

    // 8. mixed group — one valid email + one without email → filter to 1
    h.step('8] Mixed group: invalid members filtered before send → sent=1');
    {
      const r = await fastify.inject({
        method: 'POST', url, headers,
        payload: {
          group_id: mixedGroup._id.toString(), channel: 'email',
          subject: 'mixed', body: 'mixed test',
        },
      });
      const body = r.json();
      h.assertEq('status', r.statusCode, 200);
      h.assertEq('total = 1 (member without email skipped)', body.data?.total, 1);
      h.assertEq('sent', body.data?.sent, 1);
    }

    // 9. no auth → 401
    h.step('9] no auth → 401');
    {
      const r = await fastify.inject({ method: 'POST', url });
      h.assertEq('status', r.statusCode, 401);
    }
  } finally {
    await deleteGroupCascade(emailGroup._id);
    await deleteGroupCascade(waGroup._id);
    await deleteGroupCascade(mixedGroup._id);
    // Restore real axios.post in case of process reuse
    axios.post = realPost;
    await h.shutdown(fastify);
  }

  h.exitWithSummary();
}

main().catch((err) => {
  console.error('Integration test errored:', err);
  process.exit(2);
});
