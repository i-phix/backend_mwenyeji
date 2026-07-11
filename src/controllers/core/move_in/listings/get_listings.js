const db = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

const formatLocation = (location = {}) => (
    [location.area, location.city, location.county, location.address]
        .filter(Boolean)
        .join(', ')
);

// GET /api/core/move_in/listings
const get_listings = async (request, reply) => {
    try {
        const { search = '', status = 'All', page = 1, limit = 20 } = request.query;

        const allListings = [];

        // --- 1. Standalone MoveInUnit listings ---
        const moveInUnits = await db.moveIn.MoveInUnit.find({}).lean();
        const landlordIds = moveInUnits.map((u) => u.landlordId).filter(Boolean);
        const landlords = landlordIds.length
            ? await db.moveIn.MoveInLandlordUser.find({ _id: { $in: landlordIds } }).select('fullName email companyName').lean()
            : [];
        const landlordMap = {};
        landlords.forEach((landlord) => {
            landlordMap[String(landlord._id)] = landlord;
        });

        moveInUnits.forEach((u) => {
            const landlord = u.landlordId ? landlordMap[String(u.landlordId)] : null;
            allListings.push({
                _id: u._id,
                source: 'standalone',
                name: u.title,
                title: u.title,
                facilityName: u.facilityName,
                listingType: u.listingType,
                moveInPrice: u.price,
                moveInBedrooms: u.bedrooms,
                moveInBathrooms: u.bathrooms,
                moveInImages: u.images,
                moveInAmenities: u.amenities,
                nearbyServices: u.nearbyServices,
                moveInDescription: u.description,
                moveInApproval: u.moveInApproval,
                listedInMoveIn: u.isListed,
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
                location: u.location,
                facilityId: {
                    name: u.facilityName || 'Move-In standalone',
                    location: formatLocation(u.location),
                },
                landlord: landlord || u.landlordId,
                landlordName: landlord?.fullName || landlord?.companyName || '—',
                landlordEmail: landlord?.email || null,
            });
        });

        // --- 2. Facility-backed units ---
        const facilities = await db.Facility.find({}).select('_id name location').lean();

        await Promise.all(
            facilities.map(async (facility) => {
                try {
                    const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
                    const units = await UnitModel.find({})
                        .select('name unitType listingType moveInPrice moveInBedrooms moveInBathrooms moveInImages moveInAmenities moveInDescription moveInApproval listedInMoveIn homeOwnerId createdAt updatedAt')
                        .lean();

                    const ownerIds = units.map((unit) => unit.homeOwnerId).filter(Boolean);
                    const owners = ownerIds.length
                        ? await db.Customer.find({ _id: { $in: ownerIds } }).select('fullName name email phoneNumber').lean().catch(() => [])
                        : [];
                    const ownerMap = {};
                    owners.forEach((owner) => {
                        ownerMap[String(owner._id)] = owner;
                    });

                    units.forEach((u) => {
                        const owner = u.homeOwnerId ? ownerMap[String(u.homeOwnerId)] : null;
                        u.source = 'facility';
                        u.facilityId = { _id: facility._id, name: facility.name, location: facility.location };
                        u.landlord = owner || u.homeOwnerId || null;
                        u.landlordName = owner?.fullName || owner?.name || '—';
                        u.landlordEmail = owner?.email || null;
                        allListings.push(u);
                    });
                } catch (e) {
                    logger.error(`[core/move_in/listings] facility ${facility._id}: ${e.message}`);
                }
            })
        );

        let filtered = allListings;

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter((u) =>
                (u.name || u.title || '').toLowerCase().includes(q) ||
                (u.landlordName || '').toLowerCase().includes(q) ||
                (u.facilityId?.name || '').toLowerCase().includes(q) ||
                (u.facilityId?.location || formatLocation(u.location)).toLowerCase().includes(q)
            );
        }

        if (status === 'Listed')   filtered = filtered.filter((u) => u.listedInMoveIn && u.moveInApproval === 'approved');
        if (status === 'Pending')  filtered = filtered.filter((u) => u.moveInApproval === 'pending');
        if (status === 'Rejected') filtered = filtered.filter((u) => u.moveInApproval === 'rejected');
        if (status === 'Unlisted') filtered = filtered.filter((u) => !u.listedInMoveIn);

        filtered.sort((a, b) => {
            const aDate = new Date(a.createdAt || a.updatedAt || 0).getTime();
            const bDate = new Date(b.createdAt || b.updatedAt || 0).getTime();
            if (bDate !== aDate) return bDate - aDate;
            return String(b._id || '').localeCompare(String(a._id || ''));
        });

        const total = filtered.length;
        const skip = (Number(page) - 1) * Number(limit);
        const paginated = filtered.slice(skip, skip + Number(limit));

        return reply.code(200).send({
            success: true,
            data: paginated,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[core/move_in/listings/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_listings;
