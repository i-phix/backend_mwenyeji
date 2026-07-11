const db = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const logger = require('../../../../config/winston');

// GET /api/move_in/listings/locations
// Returns distinct facility locations for listed units (used to populate the wizard dropdown)
const get_listing_locations = async (request, reply) => {
    try {
        const locationsMap = new Map();

        const addLocation = (value, count = 1, extra = {}) => {
            const name = String(value || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            const current = locationsMap.get(key) || { name, location: name, count: 0, ...extra };
            current.count += Number(count) || 0;
            locationsMap.set(key, current);
        };
        const approvedForMoveIn = { moveInApproval: 'approved' };

        // Pull distinct cities from standalone MoveIn units
        const moveInUnits = await db.moveIn.MoveInUnit.find({ isListed: true, moveInStatus: { $nin: ['rented', 'suspended'] }, ...approvedForMoveIn })
            .select('location.city location.county location.area location.address images')
            .lean();

        moveInUnits.forEach((unit) => {
            const name = unit.location?.area || unit.location?.city || unit.location?.county || unit.location?.address;
            const image = Array.isArray(unit.images) && unit.images.length ? unit.images[0] : undefined;
            addLocation(name, 1, image ? { image } : {});
        });

        // Also try facility-backed locations (payserve_property) — skip if DB not reachable
        try {
            const facilities = await db.Facility.find({}).select('_id name location dbName').lean();
            await Promise.all(
                facilities.map(async (facility) => {
                    try {
                        const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
                        const count = await UnitModel.countDocuments({ listedInMoveIn: true, ...approvedForMoveIn });
                        if (count > 0) addLocation(facility.location, count, { facility: facility.name });
                    } catch (e) {
                        logger.error(`[get_listing_locations] facility ${facility._id}: ${e.message}`);
                    }
                })
            );
        } catch (e) {
            logger.warn('[get_listing_locations] Facility lookup skipped: ' + e.message);
        }

        const locations = Array.from(locationsMap.values())
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        return reply.code(200).send({ success: true, data: locations });
    } catch (err) {
        logger.error('[get_listing_locations] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_listing_locations;
