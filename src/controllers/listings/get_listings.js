const Unit = require("../../models/Unit");
const serializeUnit = require("./serialize_unit");
const { splitList, matchesRoomTypes, matchesLifestyle, matchesType } = require("./filters");

// GET /api/move_in/listings
// Query params: location, purpose, roomTypes, lifestyle, type, budgetMin, budgetMax, page, limit
//
// This is the public, highest-traffic endpoint on the whole platform — and
// the one that used to fan out into a fresh MongoDB connection per PayServe
// facility on every single request (see the audit notes). It's now a single
// query against a single collection, full stop.
async function getListings(request, reply) {
  try {
    const {
      location,
      purpose,
      roomTypes,
      lifestyle,
      type,
      budgetMin,
      budgetMax,
      page = 1,
      limit = 10,
    } = request.query;

    const query = {
      isListed: true,
      status: { $ne: "suspended" },
      approvalStatus: "approved",
    };

    if (purpose && purpose !== "any") {
      query.listingType = purpose === "buy" ? "sale" : "rent";
    }

    if (location) {
      const loc = String(location).trim();
      query.$or = [
        { "location.city": { $regex: loc, $options: "i" } },
        { "location.county": { $regex: loc, $options: "i" } },
        { "location.area": { $regex: loc, $options: "i" } },
        { "location.address": { $regex: loc, $options: "i" } },
      ];
    }

    if (budgetMin || budgetMax) {
      query.price = {};
      if (budgetMin) query.price.$gte = Number(budgetMin);
      if (budgetMax) query.price.$lte = Number(budgetMax);
    }

    const requestedRoomTypes = splitList(roomTypes);
    const requestedLifestyle = splitList(lifestyle);

    // Room type / lifestyle / free-text type matching needs normalized,
    // derived logic (see filters.js) that isn't a clean Mongo query, so we
    // filter in memory — safe now because there's exactly one collection to
    // scan, not N per-facility collections.
    const candidates = await Unit.find(query).sort({ createdAt: -1 }).lean();
    const filtered = candidates.filter(
      (unit) =>
        matchesRoomTypes(unit, requestedRoomTypes) &&
        matchesLifestyle(unit, requestedLifestyle) &&
        matchesType(unit, type),
    );

    const total = filtered.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = filtered.slice(skip, skip + Number(limit)).map(serializeUnit);

    return reply.code(200).send({
      success: true,
      data: paginated,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getListings;
