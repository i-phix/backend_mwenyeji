const Unit = require("../../models/Unit");
const ViewingSlot = require("../../models/ViewingSlot");

// POST /api/move_in/landlord/viewings/slots — authenticated landlord
async function createLandlordSlot(request, reply) {
  try {
    const { unitId, date, time, capacity, durationMins } = request.body || {};
    if (!unitId || !date || !time) {
      return reply.code(400).send({ error: "unitId, date and time are required" });
    }

    const unit = await Unit.findOne({ _id: unitId, landlordId: request.user.userId });
    if (!unit) return reply.code(404).send({ error: "Unit not found" });

    const slot = await new ViewingSlot({
      unitId: unit._id,
      landlordId: request.user.userId,
      date,
      time,
      capacity: capacity ? Number(capacity) : 1,
      durationMins: durationMins ? Number(durationMins) : 30,
    }).save();

    return reply.code(201).send({ success: true, data: slot });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = createLandlordSlot;
