const Tenant = require("../../models/Tenant");

// PUT /api/move_in/profile — authenticated tenant
// The frontend sends email/isEmailVerified back too even though the form
// doesn't expose editing them — deliberately ignored here so a stale/
// tampered client payload can't self-verify an email or change it silently.
async function updateProfile(request, reply) {
  try {
    const { firstName, lastName, phone, nationalId, occupation, emergencyContactName, emergencyContactPhone } =
      request.body || {};

    const tenant = await Tenant.findById(request.user.userId);
    if (!tenant) return reply.code(404).send({ error: "Profile not found" });

    if (firstName || lastName) {
      tenant.fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || tenant.fullName;
    }
    if (phone !== undefined) tenant.phoneNumber = phone;
    if (nationalId !== undefined) tenant.nationalId = nationalId;
    if (occupation !== undefined) tenant.occupation = occupation;
    if (emergencyContactName !== undefined) tenant.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) tenant.emergencyContactPhone = emergencyContactPhone;

    await tenant.save();

    return reply.code(200).send({ success: true });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateProfile;
