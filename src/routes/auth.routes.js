const adminLogin = require("../controllers/auth/admin_login");
const tenantRegister = require("../controllers/auth/tenant_register");
const tenantLogin = require("../controllers/auth/tenant_login");
const landlordRegister = require("../controllers/auth/landlord_register");
const landlordLogin = require("../controllers/auth/landlord_login");

async function authRoutes(fastify) {
  // Admin
  fastify.post("/api/auth/login", adminLogin);

  // Tenant
  fastify.post("/api/move_in/auth/register", tenantRegister);
  fastify.post("/api/move_in/auth/login", tenantLogin);

  // Landlord
  fastify.post("/api/move_in/landlord/auth/register", landlordRegister);
  fastify.post("/api/move_in/landlord/auth/login", landlordLogin);
}

module.exports = authRoutes;
