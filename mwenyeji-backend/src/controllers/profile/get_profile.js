const Tenant = require("../../models/Tenant");

// GET /api/move_in/profile — authenticated tenant
async function getProfile(request, reply) {
  try {
    const tenant = await Tenant.findById(request.user.userId).select("-password");
    if (!tenant) return reply.code(404).send({ error: "Profile not found" });

    const [firstName, ...rest] = (tenant.fullName || "").split(" ");

    return reply.code(200).send({
      success: true,
      data: {
        firstName,
        lastName: rest.join(" "),
        phone: tenant.phoneNumber,
        email: tenant.email,
        isEmailVerified: tenant.isEmailVerified,
        nationalId: tenant.nationalId,
        occupation: tenant.occupation,
        emergencyContactName: tenant.emergencyContactName,
        emergencyContactPhone: tenant.emergencyContactPhone,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getProfile;
