const db = require("payservedb");
const logger = require("../../../../../config/winston");
const { notifyConfiguredAdmins } = require("../../utils/notifications");
const { normalizeCoordinates } = require("../../utils/landmarks");
const generateFacilityId = require("../../utils/generate_facility_id");

// POST /api/move_in/landlord/units
const create_unit = async (request, reply) => {
  try {
    const { userId } = request.user;
    const {
      title,
      facilityName,
      description,
      listingType,
      bedrooms,
      bathrooms,
      grossArea,
      price,
      location,
      amenities,
      nearbyServices,
      images,
    } = request.body;

    if (!title || !facilityName || !price)
      return reply
        .code(400)
        .send({ error: "title, facilityName and price are required." });

    // Frontend may send place-suggestion objects for text fields — coerce to strings
    const toLocationString = (v) => {
      if (v == null || typeof v === "string") return v;
      if (typeof v === "object")
        return v.name || v.description || v.label || v.text || null;
      return String(v);
    };
    const safeLocation = { ...(location || {}) };
    for (const key of ["area", "city", "county", "address", "landmark", "town"]) {
      if (key in safeLocation)
        safeLocation[key] = toLocationString(safeLocation[key]);
    }
    const coordinates = normalizeCoordinates(safeLocation.coordinates || {});
    const generatedFacilityId = generateFacilityId();

    const unit = await db.moveIn.MoveInUnit.create({
      landlordId: userId,
      facilityId: generatedFacilityId,
      title: title.trim(),
      facilityName: facilityName ? facilityName.trim() : null,
      description: description || null,
      listingType: listingType || null,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      grossArea: grossArea || null,
      price,
      location: { ...safeLocation, coordinates },
      amenities: Array.isArray(amenities) ? amenities : [],
      nearbyServices: Array.isArray(nearbyServices) ? nearbyServices : [],
      images: Array.isArray(images) ? images : [],
      moveInApproval: "pending",
      isListed: false,
      moveInStatus: "pending_approval",
    });

    const landlord = await db.moveIn.MoveInLandlordUser.findById(userId)
      .select("fullName email")
      .lean()
      .catch(() => null);
    await notifyConfiguredAdmins({
      subject: "New Move-In unit pending approval",
      text: `${landlord?.fullName || "A landlord"}${landlord?.email ? ` (${landlord.email})` : ""} submitted "${unit.title}" for approval.`,
    });

    logger.info(
      `[move_in/landlord] Unit created: ${unit._id} by landlord ${userId}`,
    );
    return reply.code(201).send({
      success: true,
      message: "Unit created. It will be listed once approved.",
      data: unit,
    });
  } catch (err) {
    logger.error("[move_in/landlord/create_unit] " + err.message);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = create_unit;
