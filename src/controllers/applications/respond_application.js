const Application = require("../../models/Application");
const Unit = require("../../models/Unit");
const createTenancy = require("../shared/create_tenancy");

// PUT /api/move_in/landlord/applications/:id — authenticated landlord
// Body: { action: 'approve' | 'reject' | 'rent', note? }
async function respondApplication(request, reply) {
  try {
    const { id } = request.params;
    const { action, note } = request.body || {};
    if (!["approve", "reject", "rent"].includes(action)) {
      return reply.code(400).send({ error: "action must be approve, reject or rent" });
    }

    const application = await Application.findOne({ _id: id, landlordId: request.user.userId });
    if (!application) return reply.code(404).send({ error: "Application not found" });

    if (action === "approve") {
      application.status = "approved";
    } else if (action === "reject") {
      application.status = "rejected";
    } else if (action === "rent") {
      if (application.status !== "approved") {
        return reply.code(400).send({ error: "Only approved applications can be marked as rented" });
      }
      const unit = await Unit.findById(application.unitId);
      await createTenancy({
        applicationId: application._id,
        unitId: application.unitId,
        landlordId: application.landlordId,
        tenantId: application.tenantId || undefined,
        unitName: unit?.title,
      });
      application.status = "rented";
    }

    application.landlordNote = note || application.landlordNote;
    application.respondedAt = new Date();
    await application.save();

    return reply.code(200).send({ success: true, data: application });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = respondApplication;
