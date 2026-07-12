const Unit = require("../../models/Unit");
const Application = require("../../models/Application");

// POST /api/move_in/applications/submit — authenticated tenant
async function submitApplication(request, reply) {
  try {
    const { unitId, message, desiredMoveInDate, occupation, dob, gender, termsAccepted, bookingId } = request.body || {};
    if (!unitId) return reply.code(400).send({ error: "unitId is required" });

    const unit = await Unit.findById(unitId);
    if (!unit) return reply.code(404).send({ error: "Listing not found" });

    const application = await new Application({
      unitId: unit._id,
      landlordId: unit.landlordId,
      tenantId: request.user.userId,
      message: message || "",
      desiredMoveInDate: desiredMoveInDate || undefined,
      occupation: occupation || undefined,
      dob: dob || undefined,
      gender: gender || undefined,
      termsAccepted: !!termsAccepted,
      bookingId: bookingId || undefined,
    }).save();

    return reply.code(201).send({ success: true, data: application });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = submitApplication;
