const Unit = require("../../models/Unit");

// PUT /api/move_in/landlord/units/:unitId/fees — authenticated landlord
// Body: { reservationFee: {rule,value} | null, viewingFee: {rule,value} | null }
// null means "inherit the platform default".
async function updateUnitFees(request, reply) {
  try {
    const { unitId } = request.params;
    const { reservationFee, viewingFee } = request.body || {};

    const unit = await Unit.findOne({ _id: unitId, landlordId: request.user.userId });
    if (!unit) return reply.code(404).send({ error: "Unit not found" });

    if (reservationFee === null) {
      unit.reservationFeeRule = undefined;
      unit.reservationFeeValue = undefined;
    } else if (reservationFee) {
      unit.reservationFeeRule = reservationFee.rule;
      unit.reservationFeeValue = Number(reservationFee.value) || 0;
    }

    if (viewingFee === null) {
      unit.viewingFeeRule = undefined;
      unit.viewingFeeValue = undefined;
    } else if (viewingFee) {
      unit.viewingFeeRule = viewingFee.rule;
      unit.viewingFeeValue = Number(viewingFee.value) || 0;
    }

    await unit.save();

    return reply.code(200).send({ success: true, data: unit });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateUnitFees;
