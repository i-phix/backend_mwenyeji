const FeaturedPackage = require("../../models/FeaturedPackage");

// POST /api/move_in/admin/featured-packages — authenticated admin
async function createFeaturedPackage(request, reply) {
  try {
    const { name, durationDays, price, description, isActive, sortOrder } = request.body || {};
    if (!name || !durationDays) {
      return reply.code(400).send({ error: "name and durationDays are required" });
    }

    const pkg = await new FeaturedPackage({
      name,
      durationDays: Number(durationDays),
      price: Number(price) || 0,
      description: description || "",
      isActive: isActive !== false,
      sortOrder: Number(sortOrder) || 0,
    }).save();

    return reply.code(201).send({ success: true, data: pkg });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = createFeaturedPackage;
