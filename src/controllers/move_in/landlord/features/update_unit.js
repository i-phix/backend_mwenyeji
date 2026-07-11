const db = require("payservedb");
const logger = require("../../../../../config/winston");
const { notifyConfiguredAdmins } = require("../../utils/notifications");
const { normalizeCoordinates } = require("../../utils/landmarks");
const generateFacilityId = require("../../utils/generate_facility_id");

// PUT /api/move_in/landlord/units/:unitId
const update_unit = async (request, reply) => {
  try {
    const { userId } = request.user;
    const { unitId } = request.params;
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

    const unit = await db.moveIn.MoveInUnit.findOne({
      _id: unitId,
      landlordId: userId,
    });
    if (!unit) return reply.code(404).send({ error: "Unit not found." });

    const update = {};
    if (title) update.title = title.trim();
    if (facilityName !== undefined)
      update.facilityName = facilityName ? facilityName.trim() : null;
    if (!unit.facilityId) update.facilityId = generateFacilityId();
    if (description !== undefined) update.description = description;
    if (listingType) update.listingType = listingType;
    if (bedrooms !== undefined) update.bedrooms = bedrooms;
    if (bathrooms !== undefined) update.bathrooms = bathrooms;
    if (grossArea !== undefined) update.grossArea = grossArea;
    if (price !== undefined) update.price = price;
    if (location) {
      update.location = {
        ...location,
        coordinates: normalizeCoordinates(location.coordinates || {}),
      };
    }
    if (Array.isArray(amenities)) update.amenities = amenities;
    if (Array.isArray(nearbyServices)) update.nearbyServices = nearbyServices;
    if (Array.isArray(images)) update.images = images;

    const reviewFieldsChanged = [
      price,
      facilityName,
      description,
      listingType,
      bedrooms,
      bathrooms,
      grossArea,
      location,
      Array.isArray(amenities) ? amenities : undefined,
      Array.isArray(nearbyServices) ? nearbyServices : undefined,
      Array.isArray(images) ? images : undefined,
    ].some((value) => value !== undefined);

    // Re-submit material listing changes for approval. Admin approval is the only gate for public listing.
    if (unit.moveInApproval === "approved" && reviewFieldsChanged) {
      update.moveInApproval = "pending";
      update.isListed = false;
      update.moveInStatus = "pending_approval";
    }

    const updated = await db.moveIn.MoveInUnit.findByIdAndUpdate(
      unitId,
      { $set: update },
      { new: true },
    ).lean();
    if (update.moveInApproval === "pending") {
      const landlord = await db.moveIn.MoveInLandlordUser.findById(userId)
        .select("fullName email")
        .lean()
        .catch(() => null);
      await notifyConfiguredAdmins({
        subject: "Move-In unit changes pending review",
        text: `${landlord?.fullName || "A landlord"}${landlord?.email ? ` (${landlord.email})` : ""} updated "${updated.title}" and it needs approval again.`,
      });
    }
    return reply.code(200).send({ success: true, data: updated });
  } catch (err) {
    logger.error("[move_in/landlord/update_unit] " + err.message);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = update_unit;
