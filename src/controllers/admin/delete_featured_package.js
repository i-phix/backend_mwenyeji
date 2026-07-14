const FeaturedPackage = require("../../models/FeaturedPackage");

// DELETE /api/move_in/admin/featured-packages/:packageId — authenticated admin
async function deleteFeaturedPackage(request, reply) {
  try {
    const { packageId } = request.params;
    const pkg = await FeaturedPackage.findByIdAndDelete(packageId);
    if (!pkg) return reply.code(404).send({ error: "Package not found" });

    return reply.code(200).send({ success: true });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = deleteFeaturedPackage;
