const getMyTenancies = require("../controllers/tenancy/get_my_tenancies");
const getTenantLease = require("../controllers/tenancy/get_tenant_lease");
const signTenantLease = require("../controllers/tenancy/sign_tenant_lease");
const { authenticate, requireRole } = require("../middlewares/authenticate");

async function tenancyRoutes(fastify) {
  const tenantOpts = { preHandler: [authenticate, requireRole("tenant")] };

  fastify.get("/api/move_in/tenant/tenancies", tenantOpts, getMyTenancies);
  fastify.get("/api/move_in/tenant/lease/:applicationId", tenantOpts, getTenantLease);
  fastify.post("/api/move_in/tenant/lease/:applicationId/sign", tenantOpts, signTenantLease);
}

module.exports = tenancyRoutes;
