const Tenancy = require("../../models/Tenancy");

// GET /api/move_in/tenants — authenticated tenant
// There's no multi-occupant "household" concept yet — this returns the
// tenant's own active tenancy record(s) in the shape the (currently
// unlinked/orphan) tenants.js page expects.
async function getMyTenants(request, reply) {
  try {
    const tenancies = await Tenancy.find({ tenantId: request.user.userId, status: { $ne: "cancelled" } })
      .populate("unitId", "title")
      .lean();

    const data = tenancies.map((t) => ({
      name: request.user.email,
      email: request.user.email,
      phone: undefined,
      unitName: t.unitId?.title || t.unitName || "Unit",
      moveInDate: t.startDate,
      status: t.status === "active" ? "active" : t.status === "ended" ? "inactive" : "pending",
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getMyTenants;
