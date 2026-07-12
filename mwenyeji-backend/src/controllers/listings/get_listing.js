const Unit = require("../../models/Unit");
const serializeUnit = require("./serialize_unit");

// GET /api/move_in/listings/:id
async function getListing(request, reply) {
  try {
    const { id } = request.params;
    const unit = await Unit.findById(id).lean();

    if (!unit || unit.approvalStatus !== "approved") {
      return reply.code(404).send({ error: "Listing not found" });
    }

    return reply.code(200).send({ success: true, data: serializeUnit(unit) });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getListing;
