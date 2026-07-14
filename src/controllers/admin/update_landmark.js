const Landmark = require("../../models/Landmark");

const EDITABLE = ["name", "category", "area", "city", "county", "address", "details", "isActive"];

// PUT /api/core/move_in/landmarks/:id — authenticated admin
async function updateLandmark(request, reply) {
  try {
    const { id } = request.params;
    const landmark = await Landmark.findById(id);
    if (!landmark) return reply.code(404).send({ error: "Landmark not found" });

    for (const field of EDITABLE) {
      if (request.body?.[field] !== undefined) landmark[field] = request.body[field];
    }
    if (request.body?.coordinates?.lat !== undefined) landmark.coordinates.lat = Number(request.body.coordinates.lat);
    if (request.body?.coordinates?.lng !== undefined) landmark.coordinates.lng = Number(request.body.coordinates.lng);

    await landmark.save();
    return reply.code(200).send({ success: true, data: landmark });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateLandmark;
