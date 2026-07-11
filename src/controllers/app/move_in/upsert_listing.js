const db = require('payservedb');
const logger = require('../../../../config/winston');
const {
    clean,
    getFacilityAndUnit,
    resolvePayServeLandlordForUnit,
    toArray,
    toImageArray,
} = require('./helpers');

const numberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const validListingTypes = new Set(['Apartment', 'Studio', 'Bedsitter', 'Bungalow', 'Maisonette', 'Townhouse', 'Villa', 'Office']);

async function saveListing({ facilityId, unitId, body, submit }) {
    const { facility, unit } = await getFacilityAndUnit({ facilityId, unitId });
    const { payserveLandlord, moveInLandlord } = await resolvePayServeLandlordForUnit({ facilityId, unit });

    const title = clean(body.title) || unit.name;
    const price = numberOrNull(body.price ?? body.moveInPrice);
    if (!title) {
        const error = new Error('Listing title is required.');
        error.statusCode = 400;
        throw error;
    }
    if (!price || price <= 0) {
        const error = new Error('A valid monthly price is required before this unit can be saved for Move-In.');
        error.statusCode = 400;
        throw error;
    }

    const listingType = validListingTypes.has(clean(body.listingType))
        ? clean(body.listingType)
        : (validListingTypes.has(clean(unit.listingType)) ? clean(unit.listingType) : 'Apartment');

    const images = toImageArray(body.images || body.imageUrls || unit.moveInImages || []);
    const amenities = toArray(body.amenities);
    const landmarks = toArray(body.landmarks);
    const nearbyServices = toArray(body.nearbyServices);
    const coordinates = {
        lat: numberOrNull(body.latitude ?? body.lat ?? body.coordinates?.lat),
        lng: numberOrNull(body.longitude ?? body.lng ?? body.coordinates?.lng),
    };
    const safeCoordinates = coordinates.lat !== null && coordinates.lng !== null ? coordinates : null;

    const moveInStatus = submit ? 'pending_approval' : 'draft';
    const moveInApproval = submit ? 'pending' : (unit.moveInApproval || null);

    const listingPayload = {
        landlordId: moveInLandlord._id,
        source: 'payserve',
        sourceFacilityId: facility._id,
        sourceUnitId: unit._id,
        payserveLandlordId: payserveLandlord._id,
        title,
        description: clean(body.description) || unit.moveInDescription || null,
        listingType,
        bedrooms: numberOrNull(body.bedrooms ?? unit.bedrooms),
        bathrooms: numberOrNull(body.bathrooms ?? unit.bathrooms),
        grossArea: numberOrNull(body.grossArea ?? unit.grossArea),
        price,
        location: {
            address: clean(body.locationAddress || body.address) || facility.location?.address || null,
            area: clean(body.locationArea || body.area || unit.division) || facility.location?.area || null,
            city: clean(body.locationCity || body.city) || facility.location?.city || null,
            county: clean(body.locationCounty || body.county) || facility.location?.county || null,
            landmarks,
            googleMapsUrl: clean(body.googleMapsUrl),
            coordinates: safeCoordinates,
        },
        amenities,
        nearbyServices,
        images,
        moveInApproval,
        isListed: false,
        moveInStatus,
    };

    let listing = await db.moveIn.MoveInUnit.findOne({
        source: 'payserve',
        sourceFacilityId: facility._id,
        sourceUnitId: unit._id,
    });

    if (!listing) {
        listing = await db.moveIn.MoveInUnit.create(listingPayload);
    } else {
        Object.assign(listing, listingPayload);
        await listing.save();
    }

    unit.listedInMoveIn = false;
    unit.listingType = 'rent';
    unit.moveInPrice = price;
    unit.moveInBedrooms = listingPayload.bedrooms;
    unit.moveInBathrooms = listingPayload.bathrooms;
    unit.moveInDescription = listingPayload.description;
    unit.moveInImages = images.map((image) => image.url);
    unit.moveInAmenities = amenities;
    unit.moveInLandmarks = landmarks;
    unit.moveInNearbyServices = nearbyServices;
    unit.moveInLocationAddress = listingPayload.location.address;
    unit.moveInLocationCity = listingPayload.location.city;
    unit.moveInLocationCounty = listingPayload.location.county;
    unit.moveInCoordinates = safeCoordinates;
    unit.moveInApproval = moveInApproval;
    unit.moveInStatus = moveInStatus;
    unit.moveInListingId = listing._id;
    unit.moveInLastSyncedAt = new Date();
    await unit.save();

    return { listing, unit, facility };
}

const upsert_listing = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const result = await saveListing({
            facilityId,
            unitId,
            body: request.body || {},
            submit: request.body?.submit === true,
        });

        return reply.code(200).send({
            success: true,
            message: request.body?.submit === true
                ? 'Move-In listing submitted for admin approval.'
                : 'Move-In listing draft saved.',
            data: {
                listing: result.listing,
                unit: result.unit,
                facility: result.facility,
            },
        });
    } catch (err) {
        logger.error('[app/move_in/upsert_listing] ' + err.message);
        return reply.code(err.statusCode || 502).send({ error: err.message });
    }
};

upsert_listing.saveListing = saveListing;

module.exports = upsert_listing;
