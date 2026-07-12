const Tenancy = require("../../models/Tenancy");

// GET /api/move_in/admin/leases/pending-review — authenticated admin
// Simplified single-copy-per-tenancy model: signedCopyId is always
// "current" since we don't (yet) track re-upload history.
async function getPendingLeases(request, reply) {
  try {
    const tenancies = await Tenancy.find({ leaseStatus: "uploaded" })
      .populate("unitId", "title")
      .populate("tenantId", "fullName")
      .sort({ updatedAt: -1 })
      .lean();

    const data = tenancies.map((t) => ({
      leaseId: t._id,
      signedCopyId: "current",
      tenantName: t.tenantId?.fullName || "Tenant",
      unitName: t.unitId?.title || t.unitName || "Unit",
      uploadedAt: t.updatedAt,
      filePath: t.signedLeaseUrl,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getPendingLeases;
