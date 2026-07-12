const bcrypt = require("bcryptjs");
const Landlord = require("../../models/Landlord");

// POST /api/move_in/landlord/auth/register
// TEMPORARY (Phase 1): new landlords are active immediately so the
// register -> list a unit -> browse/apply flow works end to end without
// admin tooling. Phase 4 adds a real "pending until admin-verified" gate
// (the "status" field/enum is already here for that — just not enforced
// at login yet).
async function landlordRegister(request, reply) {
  try {
    const { fullName, email, phoneNumber, password, companyName } = request.body || {};
    if (!fullName || !email || !phoneNumber || !password) {
      return reply.code(400).send({ error: "fullName, email, phoneNumber and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await Landlord.findOne({
      $or: [{ email: normalizedEmail }, { phoneNumber }],
    });
    if (existing) {
      return reply.code(409).send({ error: "An account with this email or phone already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const landlord = await new Landlord({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phoneNumber,
      companyName,
      password: hashed,
      status: "active",
    }).save();

    return reply.code(201).send({
      success: true,
      userId: landlord._id,
      message: "Application submitted. You'll be notified once your account is verified.",
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Registration failed" });
  }
}

module.exports = landlordRegister;
