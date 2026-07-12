const FeaturedPackage = require("../../models/FeaturedPackage");

// GET /api/move_in/admin/featured-packages — authenticated admin (all packages)
async function getFeaturedPackages(request, reply) {
  try {
    const packages = await FeaturedPackage.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
    return reply.code(200).send({ success: true, data: packages });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getFeaturedPackages;
