const Unit = require("../../models/Unit");
const Reservation = require("../../models/Reservation");
const { RESERVATION_HOLD_HOURS } = require("../../config/constants");

async function makeReservation(body, identity) {
  const { unitId, desiredMoveInDate, message } = body || {};
  if (!unitId) throw Object.assign(new Error("unitId is required"), { status: 400 });

  const unit = await Unit.findById(unitId);
  if (!unit) throw Object.assign(new Error("Listing not found"), { status: 404 });

  const expiresAt = new Date(Date.now() + RESERVATION_HOLD_HOURS * 60 * 60 * 1000);

  return new Reservation({
    unitId: unit._id,
    landlordId: unit.landlordId,
    unitName: unit.title,
    desiredMoveInDate: desiredMoveInDate || undefined,
    message: message || undefined,
    expiresAt,
    ...identity,
  }).save();
}

// POST /api/move_in/reservations — authenticated tenant
async function createReservation(request, reply) {
  try {
    const reservation = await makeReservation(request.body, { tenantId: request.user.userId });
    return reply.code(201).send({ success: true, data: reservation });
  } catch (err) {
    if (err.status) return reply.code(err.status).send({ error: err.message });
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = createReservation;
module.exports.makeReservation = makeReservation;
