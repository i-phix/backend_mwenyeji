const Tenancy = require("../../models/Tenancy");

// PUT /api/move_in/admin/lease/:leaseId/sign/:signedCopyId/reject — authenticated admin
// Body: { rejectionNote }
async function rejectLease(request, reply) {
  try {
    const { leaseId } = request.params;
    const { rejectionNote } = request.body || {};

    const tenancy = await Tenancy.findById(leaseId);
    if (!tenancy) return reply.code(404).send({ error: "Tenancy not found" });

    tenancy.leaseStatus = "rejected";
    tenancy.leaseRejectionReason = rejectionNote || "";
    tenancy.status = tenancy.paymentStatus === "paid" ? "awaiting_lease" : "awaiting_both";
    await tenancy.save();

    return reply.code(200).send({ success: true, data: tenancy });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = rejectLease;
