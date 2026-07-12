const Unit = require("../../models/Unit");

// GET /api/move_in/listings/locations
// Powers the homepage's "Properties By Location" section — one entry per
// distinct city/area with a live count of approved, listed units.
async function getListingLocations(request, reply) {
  try {
    const results = await Unit.aggregate([
      { $match: { isListed: true, status: { $ne: "suspended" }, approvalStatus: "approved" } },
      {
        $group: {
          _id: { $ifNull: ["$location.area", "$location.city"] },
          count: { $sum: 1 },
          image: { $first: { $arrayElemAt: ["$images", 0] } },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
      { $project: { _id: 0, name: "$_id", count: 1, image: 1 } },
    ]);

    return reply.code(200).send({ success: true, data: results });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getListingLocations;
