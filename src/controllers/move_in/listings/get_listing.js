const db = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const logger = require('../../../../config/winston');
const { nearestLandmarks, sanitizeLocation, approximateCoordinates } = require('../utils/landmarks');

// GET /api/move_in/listings/:id
// Returns a single listing by ID — checks standalone MoveInUnit first, then facility Units
const get_listing = async (request, reply) => {
    try {
        const { id } = request.params;

        // --- 1. Try standalone MoveInUnit ---
        const moveInUnit = await db.moveIn.MoveInUnit.findOne({
            _id: id,
            isListed: true,
            moveInApproval: 'approved',
            moveInStatus: { $nin: ['rented', 'suspended'] },
        }).lean();

        if (moveInUnit) {
            const landmarks = await nearestLandmarks(moveInUnit.location?.coordinates, { limit: 6 });
            // Never send the exact coordinates to the client — only a deterministically
            // fuzzed "proximity" point + radius, so the map shows an area, not a pin
            // on the unit's real location.
            const proximity = approximateCoordinates(moveInUnit.location?.coordinates, moveInUnit._id);
            return reply.code(200).send({
                success: true,
                data: {
                    _id: moveInUnit._id,
                    source: moveInUnit.source || 'standalone',
                    sourceUnitId: moveInUnit.sourceUnitId || null,
                    name: moveInUnit.title,
                    title: moveInUnit.title,
                    listingType: moveInUnit.listingType,
                    moveInPrice: moveInUnit.price,
                    price: moveInUnit.price,
                    moveInBedrooms: moveInUnit.bedrooms,
                    bedrooms: moveInUnit.bedrooms,
                    moveInBathrooms: moveInUnit.bathrooms,
                    bathrooms: moveInUnit.bathrooms,
                    moveInDescription: moveInUnit.description,
                    description: moveInUnit.description,
                    moveInImages: moveInUnit.images,
                    images: moveInUnit.images,
                    moveInAmenities: moveInUnit.amenities,
                    amenities: moveInUnit.amenities,
                    nearbyServices: moveInUnit.nearbyServices,
                    grossArea: moveInUnit.grossArea,
                    location: {
                        ...sanitizeLocation(moveInUnit.location),
                        ...(proximity ? { proximity } : {}),
                    },
                    nearestLandmarks: landmarks,
                    facilityId: moveInUnit.sourceFacilityId ? { _id: moveInUnit.sourceFacilityId } : null,
                    landlordId: moveInUnit.landlordId,
                    landlord: moveInUnit.landlordId,
                },
            });
        }

        // --- 2. Search facility-backed units ---
        try {
            const facilities = await db.Facility.find({}).select('_id name location dbName').lean();

            for (const facility of facilities) {
                try {
                    const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
                    const unit = await UnitModel.findOne({
                        _id: id,
                        listedInMoveIn: true,
                        moveInApproval: 'approved',
                        moveInStatus: { $nin: ['rented', 'suspended'] },
                        $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
                    }).select('name unitType moveInPrice moveInBedrooms moveInBathrooms moveInDescription moveInImages moveInAmenities moveInNearbyServices moveInLandmarks moveInLocationAddress moveInLocationCity moveInLocationCounty moveInCoordinates listingType facilityId floorUnitNo grossArea moveInListingId').lean();

                    if (unit) {
                        const facilityLocation = typeof facility.location === 'object' && facility.location !== null
                            ? facility.location
                            : { city: facility.location || '', address: facility.name };
                        const landmarks = await nearestLandmarks(unit.moveInCoordinates, { limit: 6 });
                        // Fuzzed proximity point instead of the exact coordinates — see note above.
                        const proximity = approximateCoordinates(unit.moveInCoordinates, unit.moveInListingId || unit._id);
                        return reply.code(200).send({
                            success: true,
                            data: {
                                _id: unit.moveInListingId || unit._id,
                                source: 'payserve',
                                sourceUnitId: unit._id,
                                name: unit.name,
                                title: unit.name,
                                listingType: unit.listingType,
                                moveInPrice: unit.moveInPrice,
                                price: unit.moveInPrice,
                                moveInBedrooms: unit.moveInBedrooms,
                                bedrooms: unit.moveInBedrooms,
                                moveInBathrooms: unit.moveInBathrooms,
                                bathrooms: unit.moveInBathrooms,
                                moveInDescription: unit.moveInDescription,
                                description: unit.moveInDescription,
                                moveInImages: unit.moveInImages,
                                images: unit.moveInImages,
                                moveInAmenities: unit.moveInAmenities,
                                amenities: unit.moveInAmenities,
                                nearbyServices: unit.moveInNearbyServices || [],
                                landmarks: unit.moveInLandmarks || [],
                                grossArea: unit.grossArea,
                                location: {
                                    city: unit.moveInLocationCity || facilityLocation.city || facilityLocation.town || '',
                                    county: unit.moveInLocationCounty || facilityLocation.county || '',
                                    address: unit.moveInLocationAddress || facilityLocation.address || facility.name,
                                    landmarks: unit.moveInLandmarks || [],
                                    ...(proximity ? { proximity } : {}),
                                },
                                nearestLandmarks: landmarks,
                                facilityId: { _id: facility._id, name: facility.name, location: facility.location },
                            },
                        });
                    }
                } catch (e) {
                    logger.error(`[get_listing] facility ${facility._id}: ${e.message}`);
                }
            }
        } catch (e) {
            logger.warn('[get_listing] Facility lookup skipped: ' + e.message);
        }

        return reply.code(404).send({ error: 'Listing not found.' });
    } catch (err) {
        logger.error('[get_listing] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_listing;
