const PlatformSetting = require("../../models/PlatformSetting");
const { uploadBuffer } = require("../../utils/gcsUpload");

// POST /api/move_in/admin/lease/default — authenticated admin
// multipart/form-data, field name "lease" (PDF only)
async function uploadDefaultLease(request, reply) {
  try {
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

    const settings = await PlatformSetting.getSingleton();
    settings.defaultLeaseUrl = url;
    await settings.save();

    return reply.code(200).send({ success: true, data: settings });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = uploadDefaultLease;
