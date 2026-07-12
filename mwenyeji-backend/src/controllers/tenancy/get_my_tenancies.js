const Tenancy = require("../../models/Tenancy");

// GET /api/move_in/tenant/tenancies — authenticated tenant
async function getMyTenancies(request, reply) {
  try {
    const tenancies = await Tenancy.find({ tenantId: request.user.userId })
      .populate("unitId", "title")
      .sort({ createdAt: -1 })
      .lean();

    const data = tenancies.map((t) => ({
      ...t,
      unitName: t.unitId?.title || t.unitName || "Unit",
      unitId: t.unitId?._id || t.unitId,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getMyTenancies;
