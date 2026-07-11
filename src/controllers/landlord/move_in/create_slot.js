const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// POST /api/landlord/move_in/viewing/slots
const create_slot = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { unitId, unitName, facilityId, date, time, durationMins, capacity } = request.body;
        if (!unitId || !date || !time) return reply.code(400).send({ error: 'unitId, date, and time are required.' });

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);
        const listing = await db.moveIn.MoveInUnit.findOne({
            _id: unitId,
            ...landlordRecordFilter({ payserveUserId: userId, moveInLandlordId: moveInLandlord._id }),
        }).lean();
        if (!listing) return reply.code(404).send({ error: 'Move-In listing not found for this landlord.' });

        const slot = await db.moveIn.MoveInViewingSlot.create({
            landlordId: moveInLandlord._id,
            unitId,
            unitName: unitName || listing.title || null,
            facilityId: facilityId || listing.sourceFacilityId || null,
            date: new Date(date),
            time,
            durationMins: durationMins || 30,
            capacity: capacity || 1,
            bookedCount: 0,
            isAvailable: true,
        });

        logger.info(`[landlord/move_in] Slot created by landlord ${userId} for unit ${unitId}`);
        return reply.code(200).send({ success: true, message: 'Slot created.', data: { slotId: slot._id } });
    } catch (err) {
        logger.error('[landlord/move_in/create_slot] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = create_slot;
