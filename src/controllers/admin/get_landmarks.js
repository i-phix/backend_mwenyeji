const Landmark = require("../../models/Landmark");

// GET /api/core/move_in/landmarks — authenticated admin
// Query: search, category, status ('active'|'inactive'|'all', default 'active')
async function getLandmarks(request, reply) {
  try {
    const { search, category, status } = request.query || {};

    const filter = {};
    if (status === "active" || !status) filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;
    if (category) filter.category = category;
    if (search) filter.name = new RegExp(search, "i");

    const landmarks = await Landmark.find(filter).sort({ name: 1 }).lean();
    return reply.code(200).send({ success: true, data: landmarks });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandmarks;
