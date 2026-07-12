const FeaturedPackage = require("../../models/FeaturedPackage");

// GET /api/move_in/landlord/featured-packages — authenticated landlord (active only)
async function getLandlordFeaturedPackages(request, reply) {
  try {
    const packages = await FeaturedPackage.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }).lean();
    return reply.code(200).send({ success: true, data: packages });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlordFeaturedPackages;
