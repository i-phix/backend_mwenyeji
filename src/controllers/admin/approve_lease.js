const Tenancy = require("../../models/Tenancy");

// PUT /api/move_in/admin/lease/:leaseId/sign/:signedCopyId/approve — authenticated admin
async function approveLease(request, reply) {
  try {
    const { leaseId } = request.params;
    const tenancy = await Tenancy.findById(leaseId);
    if (!tenancy) return reply.code(404).send({ error: "Tenancy not found" });

    tenancy.leaseStatus = "approved";
    tenancy.leaseRejectionReason = undefined;

    if (tenancy.paymentStatus === "paid") {
      tenancy.status = "active";
      if (!tenancy.startDate) tenancy.startDate = new Date();
    } else {
      tenancy.status = "awaiting_payment";
    }
    await tenancy.save();

    return reply.code(200).send({ success: true, data: tenancy });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = approveLease;
