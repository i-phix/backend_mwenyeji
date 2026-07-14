const bcrypt = require("bcryptjs");
const Landlord = require("../../models/Landlord");
const { signToken } = require("../../utils/jwt");

// POST /api/move_in/landlord/auth/login
async function landlordLogin(request, reply) {
  try {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const landlord = await Landlord.findOne({ email: String(email).toLowerCase().trim() });
    if (!landlord) {
      return reply.code(403).send({ error: "Invalid email or password" });
    }

    if (landlord.status === "suspended") {
      return reply.code(403).send({ error: "This account has been suspended" });
    }

    const isMatch = await bcrypt.compare(password, landlord.password);
    if (!isMatch) {
      return reply.code(403).send({ error: "Invalid email or password" });
    }

    const payload = {
      userId: landlord._id,
      fullName: landlord.fullName,
      email: landlord.email,
      phoneNumber: landlord.phoneNumber,
    };
    const authToken = signToken(payload, "landlord");

    return reply.code(200).send({
      success: true,
      user: { ...payload, type: "Landlord" },
      authToken,
      refreshToken: authToken,
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Login failed" });
  }
}

module.exports = landlordLogin;
