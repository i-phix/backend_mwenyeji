const getProfile = require("../controllers/profile/get_profile");
const updateProfile = require("../controllers/profile/update_profile");
const getTenantDashboard = require("../controllers/dashboard/get_tenant_dashboard");
const getMyTenants = require("../controllers/tenant_records/get_my_tenants");
const getChecklists = require("../controllers/tenant_records/get_checklists");
const getHandovers = require("../controllers/tenant_records/get_handovers");
const { authenticate, requireRole } = require("../middlewares/authenticate");

async function profileRoutes(fastify) {
  const tenantOpts = { preHandler: [authenticate, requireRole("tenant")] };

  fastify.get("/api/move_in/profile", tenantOpts, getProfile);
  fastify.put("/api/move_in/profile", tenantOpts, updateProfile);
  fastify.get("/api/move_in/dashboard", tenantOpts, getTenantDashboard);
  fastify.get("/api/move_in/tenants", tenantOpts, getMyTenants);
  fastify.get("/api/move_in/checklists", tenantOpts, getChecklists);
  fastify.get("/api/move_in/handovers", tenantOpts, getHandovers);
}

module.exports = profileRoutes;
