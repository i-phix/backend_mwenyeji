const Tenancy = require("../../models/Tenancy");

// GET /api/move_in/admin/leases/:leaseId/sign/:signedCopyId/download — authenticated admin
async function downloadSignedLease(request, reply) {
  try {
    const { leaseId } = request.params;
    const tenancy = await Tenancy.findById(leaseId);
    if (!tenancy || !tenancy.signedLeaseUrl) return reply.code(404).send({ error: "Signed lease not found" });

    return reply.redirect(302, tenancy.signedLeaseUrl);
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = downloadSignedLease;
