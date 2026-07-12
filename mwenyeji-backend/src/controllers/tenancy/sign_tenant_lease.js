const Tenancy = require("../../models/Tenancy");
const { uploadBuffer } = require("../../utils/gcsUpload");

// POST /api/move_in/tenant/lease/:applicationId/sign — authenticated tenant
// multipart/form-data, field name "lease" (PDF only)
async function signTenantLease(request, reply) {
  try {
    const { applicationId } = request.params;
    const tenancy = await Tenancy.findOne({ applicationId, tenantId: request.user.userId });
    if (!tenancy) return reply.code(404).send({ error: "Tenancy not found" });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "No file uploaded" });
    if (file.mimetype !== "application/pdf") {
      return reply.code(400).send({ error: "Only PDF files are accepted" });
    }

    const buffer = await file.toBuffer();
    const url = await uploadBuffer(buffer, {
      folder: "leases/signed",
      filename: file.filename,
      contentType: file.mimetype,
    });

    tenancy.signedLeaseUrl = url;
    tenancy.leaseStatus = "uploaded";
    await tenancy.save();

    return reply.code(200).send({ success: true, data: tenancy });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = signTenantLease;
