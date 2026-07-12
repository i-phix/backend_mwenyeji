const Tenancy = require("../../models/Tenancy");

// GET /api/move_in/landlord/tenancies — authenticated landlord
async function getLandlordTenancies(request, reply) {
  try {
    const tenancies = await Tenancy.find({ landlordId: request.user.userId })
      .populate("unitId", "title")
      .populate("tenantId", "fullName email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();

    const data = tenancies.map((t) => ({
      ...t,
      unitName: t.unitId?.title || t.unitName || "Unit",
      unitId: t.unitId?._id || t.unitId,
      tenantName: t.tenantId?.fullName || "Tenant",
      tenantEmail: t.tenantId?.email || "",
      tenantPhone: t.tenantId?.phoneNumber || "",
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlordTenancies;
