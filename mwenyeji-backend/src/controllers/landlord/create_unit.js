const Unit = require("../../models/Unit");

// POST /api/move_in/landlord/units — authenticated landlord
// New units start unlisted + pending until an admin approves them (see
// controllers/admin/approve_listing.js), so nothing goes live unmoderated.
async function createUnit(request, reply) {
  try {
    const body = request.body || {};
    if (!body.title || !body.price) {
      return reply.code(400).send({ error: "title and price are required" });
    }

    const unit = await new Unit({
      landlordId: request.user.userId,
      title: body.title,
      description: body.description,
      listingType: body.listingType || "rent",
      unitType: body.unitType,
      price: body.price,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      grossArea: body.grossArea,
      images: body.images || [],
      amenities: body.amenities || [],
      nearbyServices: body.nearbyServices || [],
      location: body.location || {},
      isListed: true,
      status: "available",
      approvalStatus: "pending",
    }).save();

    return reply.code(201).send({ success: true, data: unit });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = createUnit;
