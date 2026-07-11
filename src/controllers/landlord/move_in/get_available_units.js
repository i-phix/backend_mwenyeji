const db = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');

const required = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const buildCompleteness = ({ unit, facility }) => {
    const checks = [
        { key: 'owner', complete: !!unit.homeOwnerId },
        { key: 'price', complete: required(unit.moveInPrice) },
        { key: 'location', complete: required(facility?.location?.city || facility?.location?.address || facility?.name) },
        { key: 'description', complete: required(unit.moveInDescription) },
        { key: 'photos', complete: Array.isArray(unit.moveInImages) && unit.moveInImages.length > 0 },
    ];
    const completed = checks.filter((item) => item.complete).length;
    return {
        completed,
        total: checks.length,
        percent: Math.round((completed / checks.length) * 100),
        missing: checks.filter((item) => !item.complete).map((item) => item.key),
    };
};

// GET /api/landlord/move_in/available_units
// Returns vacant facility-linked units belonging to this landlord, for form prefill
const get_available_units = async (request, reply) => {
    try {
        const { userId } = request.user;

        const user = await db.User.findById(userId).lean();
        if (!user || user.type !== 'Landlord') {
            return reply.code(403).send({ error: 'Access denied.' });
        }

        const facilityLinks = (user.customerData || []).filter(d => d.isEnabled);
        if (facilityLinks.length === 0) {
            return reply.code(200).send({ success: true, data: [] });
        }

        const results = [];
        for (const link of facilityLinks) {
            const facilityId = link.facilityId;
            const [facility, customer] = await Promise.all([
                db.Facility.findById(facilityId).lean(),
                db.Customer.findById(link.customerId).lean(),
            ]);
            if (!facility || !customer) continue;

            const UnitModel = await getModel('Unit', db.Unit.schema, facilityId);
            const vacantUnits = await UnitModel.find({
                homeOwnerId: customer._id,
                $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
            }).lean();

            for (const unit of vacantUnits) {
                const completeness = buildCompleteness({ unit, facility });
                results.push({
                    _id: unit._id,
                    name: unit.name,
                    facilityId: facility._id,
                    facilityName: facility.name,
                    status: unit.status,
                    source: 'payserve',
                    listedInMoveIn: !!unit.listedInMoveIn,
                    moveInApproval: unit.moveInApproval || null,
                    moveInStatus: unit.moveInStatus || 'draft',
                    moveInListingId: unit.moveInListingId || null,
                    listingType: unit.listingType || 'rent',
                    bedrooms: unit.bedrooms ?? null,
                    bathrooms: unit.bathrooms ?? null,
                    grossArea: unit.grossArea ?? null,
                    moveInPrice: unit.moveInPrice ?? null,
                    amenities: unit.moveInAmenities || [],
                    landmarks: unit.moveInLandmarks || [],
                    nearbyServices: unit.moveInNearbyServices || [],
                    locationCity: facility.location?.city || facility.location?.address || '',
                    locationCounty: facility.location?.county || '',
                    locationAddress: facility.location?.address || '',
                    coordinates: unit.moveInCoordinates || null,
                    completeness,
                });
            }
        }

        return reply.code(200).send({ success: true, data: results });
    } catch (err) {
        logger.error('[landlord/move_in/get_available_units] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_available_units;
