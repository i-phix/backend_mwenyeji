const Unit = require("../../models/Unit");
const PlatformSetting = require("../../models/PlatformSetting");
const { computeAmountFromRule } = require("../../utils/feeRules");

// GET /api/move_in/listings/:unitId/fees — public
// Returns both shapes the frontend reads across different pages:
//   { viewing: { amount, rule }, reservation: { amount, rule },
//     viewing_fee, reservation_fee }
async function getUnitFees(request, reply) {
  try {
    const { unitId } = request.params;
    const unit = await Unit.findById(unitId).select(
      "price reservationFeeRule reservationFeeValue viewingFeeRule viewingFeeValue",
    );
    if (!unit) return reply.code(404).send({ error: "Listing not found" });

    const settings = await PlatformSetting.getSingleton();
    const rent = Number(unit.price || 0);

    const reservationRule = unit.reservationFeeRule || settings.reservation?.rule || "same_as_rent";
    const reservationValue = unit.reservationFeeRule ? unit.reservationFeeValue : settings.reservation?.value;
    const reservationAmount = computeAmountFromRule(reservationRule, reservationValue, rent);

    const viewingRule = unit.viewingFeeRule || settings.viewing?.rule || "fixed_amount";
    const viewingValue = unit.viewingFeeRule ? unit.viewingFeeValue : settings.viewing?.value;
    const viewingAmount = computeAmountFromRule(viewingRule, viewingValue, rent);

    return reply.code(200).send({
      success: true,
      data: {
        viewing: { amount: viewingAmount, rule: viewingRule },
        reservation: { amount: reservationAmount, rule: reservationRule },
        viewing_fee: viewingAmount,
        reservation_fee: reservationAmount,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getUnitFees;
