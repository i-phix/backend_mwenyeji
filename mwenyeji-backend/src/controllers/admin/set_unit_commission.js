const Unit = require("../../models/Unit");

// PUT /api/move_in/admin/units/:unitId/commission — authenticated admin
// Body: { commissionRate: Number | null } — percentage override; null clears
// the override and falls back to the platform default commission rule.
async function setUnitCommission(request, reply) {
  try {
    const { unitId } = request.params;
    const { commissionRate } = request.body || {};

    const unit = await Unit.findById(unitId);
    if (!unit) return reply.code(404).send({ error: "Unit not found" });

    unit.commissionRate = commissionRate === null || commissionRate === undefined ? undefined : Number(commissionRate);
    await unit.save();

    return reply.code(200).send({ success: true, data: unit });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = setUnitCommission;
