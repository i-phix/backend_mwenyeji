const db = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const logger = require('../../../../config/winston');
const { nearestLandmarks, sanitizeLocation, approximateCoordinates } = require('../utils/landmarks');

const normalize = (value) => String(value || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

const splitList = (value) => String(value || '')
    .split(',')
    .map((item) => normalize(item))
    .filter(Boolean);

const textIncludes = (value, query) => normalize(value).includes(normalize(query));

const roomTypeFor = (listing) => {
    const bedrooms = Number(listing.moveInBedrooms ?? listing.bedrooms);
    const typeText = normalize(`${listing.listingType || ''} ${listing.unitType || ''} ${listing.name || ''} ${listing.title || ''}`);

    if (typeText.includes('bedsitter')) return 'bedsitter';
    if (typeText.includes('studio') || bedrooms === 0) return 'studio';
    if (bedrooms === 1) return '1_bedroom';
    if (bedrooms === 2) return '2_bedroom';
    if (bedrooms === 3) return '3_bedroom';
    if (bedrooms >= 4) return '4_bedroom_plus';
    return '';
};

const matchesPurpose = (listing, purpose) => {
    const wanted = normalize(purpose);
    if (!wanted || wanted === 'any') return true;

    const type = normalize(listing.listingType);
    if (!type) return wanted === 'rent';
    if (['sale', 'sell', 'buy', 'for_sale'].some((token) => type.includes(token))) return wanted === 'buy';
    if (['rent', 'lease', 'for_rent'].some((token) => type.includes(token))) return wanted === 'rent';

    // Existing legacy listing types such as Apartment/Studio are rental inventory.
    return wanted === 'rent';
};

const matchesRoomTypes = (listing, requested) => {
    if (!requested.length) return true;
    return requested.includes(roomTypeFor(listing));
};

const matchesLifestyle = (listing, requested) => {
    if (!requested.length) return true;
    const amenities = [
        ...(listing.moveInAmenities || []),
        ...(listing.amenities || []),
    ].map(normalize);

    return requested.every((item) => {
        if (item === 'pool') return amenities.some((a) => a.includes('pool') || a.includes('swimming'));
        if (item === 'parking') return amenities.some((a) => a.includes('parking') || a.includes('car'));
        if (item === 'family_friendly') return amenities.some((a) => a.includes('family') || a.includes('children'));
        if (item === 'pet_friendly') return amenities.some((a) => a.includes('pet'));
        return amenities.some((a) => a.includes(item));
    });
};

const matchesType = (listing, type) => {
    const wanted = normalize(type);
    if (!wanted) return true;

    if (wanted === 'house') {
        return ['house', 'bungalow', 'maisonette', 'townhouse', 'villa'].some((token) => (
            textIncludes(listing.listingType, token)
            || textIncludes(listing.unitType, token)
            || textIncludes(listing.name, token)
            || textIncludes(listing.title, token)
        ));
    }

    if (wanted === 'commercial') {
        return ['commercial', 'office', 'shop', 'retail'].some((token) => (
            textIncludes(listing.listingType, token)
            || textIncludes(listing.unitType, token)
            || textIncludes(listing.name, token)
            || textIncludes(listing.title, token)
        ));
    }

    if (wanted === 'apartment') {
        return textIncludes(listing.listingType, wanted)
            || textIncludes(listing.unitType, wanted)
            || textIncludes(listing.name, wanted)
            || textIncludes(listing.title, wanted);
    }

    const mappedRoom = roomTypeFor({ ...listing, listingType: type });
    if (mappedRoom) return roomTypeFor(listing) === mappedRoom;

    return true;
};

// GET /api/move_in/listings
// Query params: location, purpose, roomTypes, lifestyle, budgetMin, budgetMax, page, limit
const get_listings = async (request, reply) => {
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
        const requestedRoomTypes = splitList(roomTypes);
        const requestedLifestyle = splitList(lifestyle);

        const allListings = [];

        // --- 1. Standalone MoveInUnit listings (approved) ---
        const approvedForMoveIn = { moveInApproval: 'approved' };
        const unitFilter = { isListed: true, moveInStatus: { $nin: ['rented', 'suspended'] }, ...approvedForMoveIn };
        if (location) {
            const loc = location.toLowerCase().trim();
            unitFilter.$or = [
                { 'location.city': { $regex: loc, $options: 'i' } },
                { 'location.county': { $regex: loc, $options: 'i' } },
                { 'location.area': { $regex: loc, $options: 'i' } },
                { 'location.address': { $regex: loc, $options: 'i' } },
                { 'location.landmarks': { $regex: loc, $options: 'i' } },
            ];
        }
        if (budgetMin) unitFilter.price = { ...unitFilter.price, $gte: Number(budgetMin) };
        if (budgetMax) unitFilter.price = { ...unitFilter.price, $lte: Number(budgetMax) };

        const moveInUnits = await db.moveIn.MoveInUnit.find(unitFilter).lean();

        moveInUnits.forEach((u) => {
            allListings.push({
                _id: u._id,
                source: u.source || 'standalone',
                sourceUnitId: u.sourceUnitId || null,
                name: u.title,
                title: u.title,
                listingType: u.listingType,
                unitType: u.listingType,
                moveInPrice: u.price,
                price: u.price,
                moveInBedrooms: u.bedrooms,
                bedrooms: u.bedrooms,
                moveInBathrooms: u.bathrooms,
                bathrooms: u.bathrooms,
                moveInDescription: u.description,
                description: u.description,
                moveInImages: u.images,
                images: u.images,
                moveInAmenities: u.amenities,
                amenities: u.amenities,
                nearbyServices: u.nearbyServices,
                grossArea: u.grossArea,
                location: sanitizeLocation(u.location),
                _internalCoordinates: u.location?.coordinates || null,
                facilityId: u.sourceFacilityId ? { _id: u.sourceFacilityId } : null,
                landlordId: u.landlordId,
                landlord: u.landlordId,
            });
        });

        // --- 2. Facility-backed units (approved for Move-In) ---
        try {
            const facilities = await db.Facility.find({}).select('_id name location dbName').lean();

            await Promise.all(
                facilities.map(async (facility) => {
                    try {
                        const facilityFilter = {
                            listedInMoveIn: true,
                            moveInStatus: { $nin: ['rented', 'suspended'] },
                            $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
                            ...approvedForMoveIn,
                        };
                        if (budgetMin) facilityFilter.moveInPrice = { ...facilityFilter.moveInPrice, $gte: Number(budgetMin) };
                        if (budgetMax) facilityFilter.moveInPrice = { ...facilityFilter.moveInPrice, $lte: Number(budgetMax) };

                        const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
                        const units = await UnitModel.find(facilityFilter)
                            .select('name unitType moveInPrice moveInBedrooms moveInBathrooms moveInDescription moveInImages moveInAmenities moveInNearbyServices moveInLandmarks moveInLocationAddress moveInLocationCity moveInLocationCounty moveInCoordinates listingType facilityId floorUnitNo grossArea moveInListingId')
                            .lean();

                        units.forEach((u) => {
                            // location filter for facility units
                            if (location) {
                                const loc = location.toLowerCase().trim();
                                const facLoc = typeof facility.location === 'object'
                                    ? JSON.stringify(facility.location).toLowerCase()
                                    : (facility.location || '').toLowerCase();
                                const facName = (facility.name || '').toLowerCase();
                                if (!facLoc.includes(loc) && !facName.includes(loc)) return;
                            }
                            const facilityLocation = typeof facility.location === 'object' && facility.location !== null
                                ? facility.location
                                : { city: facility.location || '', address: facility.name };
                            allListings.push({
                                _id: u.moveInListingId || u._id,
                                source: 'payserve',
                                sourceUnitId: u._id,
                                name: u.name,
                                title: u.name,
                                listingType: u.listingType,
                                unitType: u.unitType,
                                moveInPrice: u.moveInPrice,
                                price: u.moveInPrice,
                                moveInBedrooms: u.moveInBedrooms,
                                bedrooms: u.moveInBedrooms,
                                moveInBathrooms: u.moveInBathrooms,
                                bathrooms: u.moveInBathrooms,
                                moveInDescription: u.moveInDescription,
                                description: u.moveInDescription,
                                moveInImages: u.moveInImages,
                                images: u.moveInImages,
                                moveInAmenities: u.moveInAmenities,
                                amenities: u.moveInAmenities,
                                nearbyServices: u.moveInNearbyServices || [],
                                landmarks: u.moveInLandmarks || [],
                                grossArea: u.grossArea,
                                location: {
                                    city: u.moveInLocationCity || facilityLocation.city || facilityLocation.town || '',
                                    county: u.moveInLocationCounty || facilityLocation.county || '',
                                    address: u.moveInLocationAddress || facilityLocation.address || facility.name,
                                    landmarks: u.moveInLandmarks || [],
                                },
                                _internalCoordinates: u.moveInCoordinates || null,
                                facilityId: { _id: facility._id, name: facility.name, location: facility.location },
                            });
                        });
                    } catch (e) {
                        logger.error(`[get_listings] facility ${facility._id}: ${e.message}`);
                    }
                })
            );
        } catch (e) {
            // Main DB (payserve_property) may not be connected in Move-In standalone mode — skip facility listings
            logger.warn('[get_listings] Facility lookup skipped: ' + e.message);
        }

        const filteredListings = allListings.filter((listing) => (
            matchesPurpose(listing, purpose)
            && matchesRoomTypes(listing, requestedRoomTypes)
            && matchesLifestyle(listing, requestedLifestyle)
            && matchesType(listing, type)
        ));

        // Paginate
        const total = filteredListings.length;
        const skip = (Number(page) - 1) * Number(limit);
        const paginatedRaw = filteredListings.slice(skip, skip + Number(limit));
        const paginated = await Promise.all(paginatedRaw.map(async (listing) => {
            const { _internalCoordinates, ...safeListing } = listing;
            // Never send exact coordinates to the client — only a deterministically
            // fuzzed "proximity" point + radius, so the map can show an area instead
            // of pinpointing the unit's real location.
            const proximity = approximateCoordinates(_internalCoordinates, listing._id);
            return {
                ...safeListing,
                location: {
                    ...(safeListing.location || {}),
                    ...(proximity ? { proximity } : {}),
                },
                nearestLandmarks: await nearestLandmarks(_internalCoordinates, { limit: 5 }),
            };
        }));

        return reply.code(200).send({
            success: true,
            data: paginated,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        logger.error('[get_listings] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_listings;
