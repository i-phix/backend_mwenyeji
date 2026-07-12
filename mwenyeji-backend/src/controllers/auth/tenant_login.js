const bcrypt = require("bcryptjs");
const Tenant = require("../../models/Tenant");
const { signToken } = require("../../utils/jwt");

// POST /api/move_in/auth/login
async function tenantLogin(request, reply) {
  try {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const tenant = await Tenant.findOne({ email: String(email).toLowerCase().trim() });
    if (!tenant) {
      return reply.code(403).send({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, tenant.password);
    if (!isMatch) {
      return reply.code(403).send({ error: "Invalid email or password" });
    }

    const payload = {
      userId: tenant._id,
      fullName: tenant.fullName,
      email: tenant.email,
      phoneNumber: tenant.phoneNumber,
    };
    const authToken = signToken(payload, "tenant");

    return reply.code(200).send({
      success: true,
      user: { ...payload, type: "Tenant" },
      authToken,
      refreshToken: authToken,
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Login failed" });
  }
}

module.exports = tenantLogin;
