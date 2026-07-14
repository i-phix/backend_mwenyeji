const Landmark = require("../../models/Landmark");
const { logAdminAction } = require("../../utils/audit");

// POST /api/core/move_in/landmarks — authenticated admin
async function createLandmark(request, reply) {
  try {
    const { name, category, area, city, county, address, details, coordinates } = request.body || {};
    if (!name || !coordinates?.lat || !coordinates?.lng) {
      return reply.code(400).send({ error: "name, coordinates.lat and coordinates.lng are required" });
    }

    const landmark = await new Landmark({
      name: name.trim(),
      category: category || "other",
      area: area || undefined,
      city: city || undefined,
      county: county || undefined,
      address: address || undefined,
      details: details || undefined,
      coordinates: { lat: Number(coordinates.lat), lng: Number(coordinates.lng) },
      isActive: true,
    }).save();

    await logAdminAction(request, { action: "create_landmark", resourceType: "Landmark", resourceId: landmark._id, details: landmark.name });

    return reply.code(201).send({ success: true, data: landmark });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = createLandmark;
