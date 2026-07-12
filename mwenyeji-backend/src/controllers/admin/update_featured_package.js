const FeaturedPackage = require("../../models/FeaturedPackage");

const EDITABLE_FIELDS = ["name", "durationDays", "price", "description", "isActive", "sortOrder"];

// PUT /api/move_in/admin/featured-packages/:packageId — authenticated admin
async function updateFeaturedPackage(request, reply) {
  try {
    const { packageId } = request.params;
    const pkg = await FeaturedPackage.findById(packageId);
    if (!pkg) return reply.code(404).send({ error: "Package not found" });

    for (const field of EDITABLE_FIELDS) {
      if (request.body?.[field] !== undefined) pkg[field] = request.body[field];
    }
    await pkg.save();

    return reply.code(200).send({ success: true, data: pkg });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateFeaturedPackage;
