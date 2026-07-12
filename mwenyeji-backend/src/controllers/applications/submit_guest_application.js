const Unit = require("../../models/Unit");
const Application = require("../../models/Application");

// POST /api/move_in/applications/submit_guest — no auth required
async function submitGuestApplication(request, reply) {
  try {
    const { unitId, fullName, email, phoneNumber, message, desiredMoveInDate, occupation, dob, gender, termsAccepted } = request.body || {};
    if (!unitId || !fullName || !email || !phoneNumber) {
      return reply.code(400).send({ error: "unitId, fullName, email and phoneNumber are required" });
    }

    const unit = await Unit.findById(unitId);
    if (!unit) return reply.code(404).send({ error: "Listing not found" });

    const application = await new Application({
      unitId: unit._id,
      landlordId: unit.landlordId,
      guest: { fullName, email, phoneNumber },
      message: message || "",
      desiredMoveInDate: desiredMoveInDate || undefined,
      occupation: occupation || undefined,
      dob: dob || undefined,
      gender: gender || undefined,
      termsAccepted: !!termsAccepted,
    }).save();

    return reply.code(201).send({ success: true, data: application });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = submitGuestApplication;
