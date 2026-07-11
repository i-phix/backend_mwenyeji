const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// GET /api/landlord/move_in/units
// Returns all MoveInUnit listings created by this landlord
const get_units = async (request, reply) => {
    try {
        const { userId } = request.user;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);

        const units = await db.moveIn.MoveInUnit.find(landlordRecordFilter({
            payserveUserId: userId,
            moveInLandlordId: moveInLandlord._id,
        }))
            .sort({ createdAt: -1 })
            .lean();

        const facilityIds = [...new Set(units.map((unit) => String(unit.sourceFacilityId || '')).filter(Boolean))];
        const facilities = facilityIds.length
            ? await db.Facility.find({ _id: { $in: facilityIds } }).select('name location').lean()
            : [];
        const facilityMap = new Map(facilities.map((facility) => [String(facility._id), facility]));
        const enriched = units.map((unit) => {
            const facility = unit.sourceFacilityId ? facilityMap.get(String(unit.sourceFacilityId)) : null;
            return {
                ...unit,
                facilityName: facility?.name || null,
                sourceFacilityName: facility?.name || null,
                sourceFacilityLocation: facility?.location || null,
            };
        });

        return reply.code(200).send({ success: true, data: enriched });
    } catch (err) {
        logger.error('[landlord/move_in/get_units] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = get_units;
