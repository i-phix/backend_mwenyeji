const Unit = require("../../models/Unit");

// GET /api/core/move_in/listings — authenticated admin
async function getListingsAdmin(request, reply) {
  try {
    const { status, page = 1, limit = 20 } = request.query;
    const query = {};
    if (status) query.approvalStatus = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [units, total] = await Promise.all([
      Unit.find(query)
        .populate("landlordId", "fullName email phoneNumber companyName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Unit.countDocuments(query),
    ]);

    return reply.code(200).send({
      success: true,
      data: units,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) || 1 },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getListingsAdmin;
