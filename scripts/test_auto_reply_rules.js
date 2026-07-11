/**
 * Integration test for the auto-reply rules feature (PR4).
 *
 * HTTP coverage:
 *   POST   /api/core/customer_obsession/auto-reply-rules
 *   GET    /api/core/customer_obsession/auto-reply-rules
 *   PUT    /api/core/customer_obsession/auto-reply-rules/:id
 *   POST   /api/core/customer_obsession/auto-reply-rules/reorder
 *   DELETE /api/core/customer_obsession/auto-reply-rules/:id
 *
 * Plus direct calls to matchAutoReplyRule (no HTTP):
 *   - case-insensitive whole-word match
 *   - first-match-wins by priority
 *   - @payserve.co.ke sender skipped (loop guard)
 *   - no match returns null
 *
 * Run:  cd payserve_backend && node scripts/test_auto_reply_rules.js
 */

const payservedb = require('payservedb');
const h = require('./_test_helpers');
const { matchAutoReplyRule } = require('../src/utils/auto_reply');

async function main() {
  h.setSuite('AutoReplyRules');
  await h.connect();

  // Pre-cleanup: remove leftover test rows from previous failed runs
  await payservedb.AutoReplyRule.deleteMany({ keyword: { $regex: '^itest_', $options: 'i' } });

  const fastify = await h.bootFastify({
    routes: [require('../src/routes/core')],
  });

  const base = '/api/core/customer_obsession/auto-reply-rules';
  const adminH = h.adminAuth();
  const ids = [];

  try {
    // 1. POST create rule
    h.step('1] POST create email rule (itest_hello)');
    {
      const r = await fastify.inject({
        method: 'POST', url: base, headers: adminH,
        payload: { channel: 'email', keyword: 'itest_hello', reply: 'Hi there!' },
      });
      const body = r.json();
      h.assertEq("status", r.statusCode, 200);
      h.assertEq('success', body.success, true);
      h.assertEq('keyword stored', body.data?.keyword, 'itest_hello');
      h.assertEq('reply stored', body.data?.reply, 'Hi there!');
      h.assertEq('enabled default true', body.data?.enabled, true);
      ids.push(body.data?._id);
    }

    // 2. POST a second rule, different keyword same channel
    h.step('2] POST create email rule (itest_help)');
    {
      const r = await fastify.inject({
        method: 'POST', url: base, headers: adminH,
        payload: { channel: 'email', keyword: 'itest_help', reply: 'We are on it.' },
      });
      h.assertEq("status", r.statusCode, 200);
      ids.push(r.json().data?._id);
    }

    // 3. POST duplicate (channel, keyword, case-insensitive) → 409
    h.step('3] POST duplicate (case-insensitive) → 409');
    {
      const r = await fastify.inject({
        method: 'POST', url: base, headers: adminH,
        payload: { channel: 'email', keyword: 'ITEST_HELLO', reply: 'x' },
      });
      h.assertEq('status', r.statusCode, 409);
    }

    // 4. POST multi-word keyword → 400
    h.step('4] POST multi-word keyword → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url: base, headers: adminH,
        payload: { channel: 'email', keyword: 'two words', reply: 'x' },
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 5. POST reply >1000 chars → 400
    h.step('5] POST reply > 1000 chars → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url: base, headers: adminH,
        payload: { channel: 'email', keyword: 'itest_long', reply: 'x'.repeat(1001) },
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 6. PUT update reply text
    h.step('6] PUT update reply text');
    {
      const r = await fastify.inject({
        method: 'PUT', url: `${base}/${ids[0]}`, headers: adminH,
        payload: { reply: 'Updated reply text' },
      });
      h.assertEq('status', r.statusCode, 200);
      h.assertEq('reply updated', r.json().data?.reply, 'Updated reply text');
    }

    // 7. POST reorder — swap priorities so help fires before hello
    h.step('7] POST reorder: help first, hello second');
    {
      const r = await fastify.inject({
        method: 'POST', url: `${base}/reorder`, headers: adminH,
        payload: { ordered_ids: [ids[1], ids[0]] },
      });
      h.assertEq('status', r.statusCode, 200);
      h.assertEq('success', r.json().success, true);
    }

    // 8. GET list — priority 0 should be the help rule now
    h.step('8] GET list reflects new priority order');
    {
      const r = await fastify.inject({ method: 'GET', url: base, headers: adminH });
      const data = r.json().data || [];
      const ours = data.filter((row) => /^itest_/.test(row.keyword)).sort((a, b) => a.priority - b.priority);
      h.assertEq('first is itest_help', ours[0]?.keyword, 'itest_help');
      h.assertEq('second is itest_hello', ours[1]?.keyword, 'itest_hello');
    }

    // 9. matcher — first-match-wins under the new order
    h.step('9] matcher first-match-wins (help wins over hello)');
    {
      const m = await matchAutoReplyRule({
        channel: 'email',
        body: 'itest_hello, I need itest_help',
        senderAddress: 'customer@example.com',
      });
      h.assertTruthy('matched something', m);
      h.assertEq('matched keyword', m?.matched, 'itest_help');
    }

    // 10. matcher — whole-word case-insensitive
    h.step('10] matcher case-insensitive, whole-word');
    {
      const yes = await matchAutoReplyRule({
        channel: 'email', body: 'ITEST_HELLO!', senderAddress: 'a@b.com',
      });
      h.assertTruthy('uppercase matches', yes);
      // Whole-word: substring inside another token should NOT match
      const no = await matchAutoReplyRule({
        channel: 'email', body: 'preitest_hellopost', senderAddress: 'a@b.com',
      });
      h.assertEq('substring inside another token does not match', no, null);
    }

    // 11. matcher — internal sender skipped (loop guard)
    h.step('11] matcher skips @payserve.co.ke senders');
    {
      const m = await matchAutoReplyRule({
        channel: 'email', body: 'itest_hello', senderAddress: 'steve@payserve.co.ke',
      });
      h.assertEq('returned null for internal sender', m, null);
    }

    // 12. matcher — no match returns null
    h.step('12] matcher returns null when no keyword matches');
    {
      const m = await matchAutoReplyRule({
        channel: 'email', body: 'nothing relevant here', senderAddress: 'a@b.com',
      });
      h.assertEq('no match returns null', m, null);
    }

    // 13. matcher — disabled rule doesn't fire
    h.step('13] matcher skips disabled rules');
    {
      // Disable both rules
      await fastify.inject({
        method: 'PUT', url: `${base}/${ids[0]}`, headers: adminH,
        payload: { enabled: false },
      });
      await fastify.inject({
        method: 'PUT', url: `${base}/${ids[1]}`, headers: adminH,
        payload: { enabled: false },
      });
      const m = await matchAutoReplyRule({
        channel: 'email', body: 'itest_hello and itest_help', senderAddress: 'a@b.com',
      });
      h.assertEq('disabled rules do not match', m, null);
    }

    // 14. DELETE both rules
    h.step('14] DELETE rules (cleanup)');
    for (const id of ids) {
      const r = await fastify.inject({ method: 'DELETE', url: `${base}/${id}`, headers: adminH });
      h.assertEq('status', r.statusCode, 200);
    }
    h.step('14b] DELETE again → 404');
    {
      const r = await fastify.inject({ method: 'DELETE', url: `${base}/${ids[0]}`, headers: adminH });
      h.assertEq('status', r.statusCode, 404);
    }
  } finally {
    // Belt and braces — sweep any leftovers
    await payservedb.AutoReplyRule.deleteMany({ keyword: { $regex: '^itest_', $options: 'i' } });
    await h.shutdown(fastify);
  }

  h.exitWithSummary();
}

main().catch((err) => {
  console.error('Integration test errored:', err);
  process.exit(2);
});
