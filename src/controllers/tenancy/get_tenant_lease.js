const Tenancy = require("../../models/Tenancy");
const Unit = require("../../models/Unit");
const PlatformSetting = require("../../models/PlatformSetting");

// GET /api/move_in/tenant/lease/:applicationId — authenticated tenant
// Redirects to the lease PDF (unit-specific template, or the platform
// default) so the frontend's plain `fetch(...).blob()` call works
// unmodified. Flips leaseStatus pending -> downloaded on first fetch.
async function getTenantLease(request, reply) {
  try {
    const { applicationId } = request.params;
    const tenancy = await Tenancy.findOne({ applicationId, tenantId: request.user.userId });
    if (!tenancy) return reply.code(404).send({ error: "Tenancy not found" });

    const unit = await Unit.findById(tenancy.unitId).select("leaseDocumentUrl");
    let leaseUrl = tenancy.leaseDocumentUrl || unit?.leaseDocumentUrl;
    if (!leaseUrl) {
      const settings = await PlatformSetting.getSingleton();
      leaseUrl = settings.defaultLeaseUrl;
    }
    if (!leaseUrl) return reply.code(404).send({ error: "Lease document not available yet" });

    if (tenancy.leaseStatus === "pending") {
      tenancy.leaseStatus = "downloaded";
      if (!tenancy.leaseDocumentUrl) tenancy.leaseDocumentUrl = leaseUrl;
      await tenancy.save();
    }

    return reply.redirect(302, leaseUrl);
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getTenantLease;
