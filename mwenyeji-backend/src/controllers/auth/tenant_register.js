const bcrypt = require("bcryptjs");
const Tenant = require("../../models/Tenant");
const { signToken } = require("../../utils/jwt");

// POST /api/move_in/auth/register
async function tenantRegister(request, reply) {
  try {
    const { fullName, email, phoneNumber, password } = request.body || {};
    if (!fullName || !email || !password) {
      return reply.code(400).send({ error: "fullName, email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await Tenant.findOne({ email: normalizedEmail });
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const tenant = await new Tenant({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phoneNumber,
      password: hashed,
      isEmailVerified: true, // simplified for now — email verification flow lands in a later phase
    }).save();

    return reply.code(201).send({
      success: true,
      userId: tenant._id,
      message: "Account created.",
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Registration failed" });
  }
}

module.exports = tenantRegister;
