/**
 * Integration test for the always-CC email config (PR3).
 *
 *   admin (COREUSER JWT):
 *     POST   /api/core/customer_obsession/email-cc-config
 *     GET    /api/core/customer_obsession/email-cc-config
 *     PUT    /api/core/customer_obsession/email-cc-config/:id
 *     DELETE /api/core/customer_obsession/email-cc-config/:id
 *
 *   agent (AGENTUSER JWT):
 *     GET    /api/customer_obsession/settings/email-cc        (enabled only)
 *
 * Run:  cd payserve_backend && node scripts/test_email_cc_config.js
 */

const payservedb = require('payservedb');
const h = require('./_test_helpers');

async function main() {
  h.setSuite('EmailCcConfig');
  await h.connect();
  const fastify = await h.bootFastify({
    routes: [require('../src/routes/core'), require('../src/routes/customer_obsession')],
  });

  const adminUrl = '/api/core/customer_obsession/email-cc-config';
  const agentUrl = '/api/customer_obsession/settings/email-cc';
  const adminH = h.adminAuth();
  const agentH = h.agentAuth();

  const probeAddress = `integration-test-${Date.now()}@payserve.test`;
  let rowId = null;

  try {
    // 1. POST add address
    h.step('1] POST add address');
    {
      const r = await fastify.inject({
        method: 'POST', url: adminUrl, headers: adminH,
        payload: { address: probeAddress },
      });
      const body = r.json();
      h.assertEq("status", r.statusCode, 200);
      h.assertEq('success', body.success, true);
      h.assertEq('address persisted lowercase', body.data?.address, probeAddress.toLowerCase());
      h.assertEq('enabled defaults true', body.data?.enabled, true);
      rowId = body.data?._id;
      h.assertTruthy('id returned', rowId);
    }
    if (!rowId) throw new Error('No row id from create — aborting');

    // 2. POST duplicate → 409
    h.step('2] POST duplicate → 409');
    {
      const r = await fastify.inject({
        method: 'POST', url: adminUrl, headers: adminH,
        payload: { address: probeAddress.toUpperCase() },
      });
      h.assertEq('status', r.statusCode, 409);
    }

    // 3. POST invalid email → 400
    h.step('3] POST invalid email → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url: adminUrl, headers: adminH,
        payload: { address: 'not-an-email' },
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 4. POST missing address → 400
    h.step('4] POST missing address → 400');
    {
      const r = await fastify.inject({
        method: 'POST', url: adminUrl, headers: adminH, payload: {},
      });
      h.assertEq('status', r.statusCode, 400);
    }

    // 5. GET admin list — includes our row
    h.step('5] GET admin list includes new address');
    {
      const r = await fastify.inject({ method: 'GET', url: adminUrl, headers: adminH });
      const body = r.json();
      h.assertEq('status', r.statusCode, 200);
      const found = (body.data || []).find((row) => row.address === probeAddress.toLowerCase());
      h.assertTruthy('row present', found);
    }

    // 6. GET agent list — includes our row (enabled)
    h.step('6] GET agent list includes enabled row');
    {
      const r = await fastify.inject({ method: 'GET', url: agentUrl, headers: agentH });
      const body = r.json();
      h.assertEq('status', r.statusCode, 200);
      const found = (body.data || []).find((row) => row.address === probeAddress.toLowerCase());
      h.assertTruthy('row visible to agent', found);
    }

    // 7. PUT disable
    h.step('7] PUT disable');
    {
      const r = await fastify.inject({
        method: 'PUT', url: `${adminUrl}/${rowId}`, headers: adminH,
        payload: { enabled: false },
      });
      const body = r.json();
      h.assertEq('status', r.statusCode, 200);
      h.assertEq('enabled is false', body.data?.enabled, false);
    }

    // 8. GET agent list — row gone (only enabled rows surface)
    h.step('8] disabled row not in agent list');
    {
      const r = await fastify.inject({ method: 'GET', url: agentUrl, headers: agentH });
      const body = r.json();
      const found = (body.data || []).find((row) => row.address === probeAddress.toLowerCase());
      h.assertEq('row absent', !!found, false);
    }

    // 9. PUT change address
    h.step('9] PUT change address');
    {
      const newAddr = `renamed-${Date.now()}@payserve.test`;
      const r = await fastify.inject({
        method: 'PUT', url: `${adminUrl}/${rowId}`, headers: adminH,
        payload: { address: newAddr },
      });
      h.assertEq('status', r.statusCode, 200);
      h.assertEq('address updated', r.json().data?.address, newAddr);
    }

    // 10. No auth → 401
    h.step('10] No auth → 401');
    {
      const r = await fastify.inject({ method: 'GET', url: adminUrl });
      h.assertEq('status', r.statusCode, 401);
    }

    // 11. Bad id format → 500 (mongoose CastError) — acceptable, code shouldn't crash
    h.step('11] DELETE garbage id → 500 (handled, not crash)');
    {
      const r = await fastify.inject({
        method: 'DELETE', url: `${adminUrl}/not-a-valid-id`, headers: adminH,
      });
      h.assertTruthy('responded with an error status (not crash)', r.statusCode >= 400);
    }

    // 12. DELETE → 200 + row gone from list
    h.step('12] DELETE cleanup');
    {
      const r = await fastify.inject({
        method: 'DELETE', url: `${adminUrl}/${rowId}`, headers: adminH,
      });
      h.assertEq('status', r.statusCode, 200);
    }
    h.step('12b] DELETE again → 404');
    {
      const r = await fastify.inject({
        method: 'DELETE', url: `${adminUrl}/${rowId}`, headers: adminH,
      });
      h.assertEq('status', r.statusCode, 404);
    }
  } finally {
    if (rowId) {
      try { await payservedb.EmailCcConfig.findByIdAndDelete(rowId); } catch (_) {}
    }
    await h.shutdown(fastify);
  }

  h.exitWithSummary();
}

main().catch((err) => {
  console.error('Integration test errored:', err);
  process.exit(2);
});
