const Unit = require("../../models/Unit");
const { uploadBuffer } = require("../../utils/gcsUpload");

// POST /api/move_in/admin/units/:unitId/lease — authenticated admin
// multipart/form-data, field name "lease" (PDF only)
async function uploadUnitLease(request, reply) {
  try {
    const { unitId } = request.params;
    const unit = await Unit.findById(unitId);
    if (!unit) return reply.code(404).send({ error: "Unit not found" });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "No file uploaded" });
    if (file.mimetype !== "application/pdf") {
      return reply.code(400).send({ error: "Only PDF files are accepted" });
    }

    const buffer = await file.toBuffer();
    const url = await uploadBuffer(buffer, {
      folder: "leases/templates",
      filename: file.filename,
      contentType: file.mimetype,
    });

    unit.leaseDocumentUrl = url;
    await unit.save();

    return reply.code(200).send({ success: true, data: unit });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = uploadUnitLease;
