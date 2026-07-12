const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { signToken } = require("../../utils/jwt");

// POST /api/auth/login
// Frontend sends { userName, password } (userName is treated as email here —
// admin accounts don't have a phone-login path, unlike the old shared login).
async function adminLogin(request, reply) {
  try {
    const { userName, password } = request.body || {};
    if (!userName || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const email = String(userName).toLowerCase().trim();
    const user = await User.findOne({ email });

    if (!user || !user.isEnabled) {
      return reply.code(403).send({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return reply.code(403).send({ error: "Invalid email or password" });
    }

    const payload = {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
    };
    const authToken = signToken(payload, "admin");

    return reply.code(200).send({
      user: { ...payload, type: "Admin", role: user.role },
      authToken,
      refreshToken: authToken, // single-token model for now; see note in src/utils/jwt.js
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Login failed" });
  }
}

module.exports = adminLogin;
