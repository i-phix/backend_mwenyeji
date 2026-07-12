// Maps a clean Unit document to the response shape the existing frontend
// already expects (it reads unit.moveInBedrooms ?? unit.bedrooms, etc. —
// a holdover from when listings could come from two different sources).
// Keeping both keys here means zero frontend changes were needed for the
// backend rewrite; the *stored* schema itself has just one clean field.
function serializeUnit(unit) {
  const u = typeof unit.toObject === "function" ? unit.toObject() : unit;

  return {
    _id: u._id,
    source: "standalone",
    name: u.title,
    title: u.title,
    listingType: u.listingType,
    unitType: u.unitType,
    price: u.price,
    moveInPrice: u.price,
    bedrooms: u.bedrooms,
    moveInBedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    moveInBathrooms: u.bathrooms,
    description: u.description,
    moveInDescription: u.description,
    images: u.images,
    moveInImages: u.images,
    amenities: u.amenities,
    moveInAmenities: u.amenities,
    nearbyServices: u.nearbyServices,
    grossArea: u.grossArea,
    location: u.location,
    facilityId: null,
    landlordId: u.landlordId,
    landlord: u.landlordId,
    featuredUntil: u.featuredUntil,
    status: u.status,
    approvalStatus: u.approvalStatus,
    createdAt: u.createdAt,
  };
}

module.exports = serializeUnit;
