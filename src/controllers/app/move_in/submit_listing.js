const db = require('payservedb');
const logger = require('../../../../config/winston');
const { getFacilityAndUnit, resolvePayServeLandlordForUnit } = require('./helpers');
const upsertListing = require('./upsert_listing');

const submit_listing = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const { unit } = await getFacilityAndUnit({ facilityId, unitId });
        await resolvePayServeLandlordForUnit({ facilityId, unit });

        if (!unit.moveInListingId) {
            const result = await upsertListing.saveListing({
                facilityId,
                unitId,
                body: request.body || {},
                submit: true,
            });
            return reply.code(200).send({
                success: true,
                message: 'Move-In listing submitted for admin approval.',
                data: result,
            });
        }

        const listing = await db.moveIn.MoveInUnit.findOne({
            _id: unit.moveInListingId,
            source: 'payserve',
            sourceFacilityId: facilityId,
            sourceUnitId: unitId,
        });

        if (!listing) {
            const error = new Error('Linked Move-In listing was not found. Save the listing details again before submitting.');
            error.statusCode = 404;
            throw error;
        }

        listing.moveInApproval = 'pending';
        listing.moveInStatus = 'pending_approval';
        listing.isListed = false;
        await listing.save();

        unit.moveInApproval = 'pending';
        unit.moveInStatus = 'pending_approval';
        unit.listedInMoveIn = false;
        unit.moveInLastSyncedAt = new Date();
        await unit.save();

        return reply.code(200).send({
            success: true,
            message: 'Move-In listing submitted for admin approval.',
            data: { listing, unit },
        });
    } catch (err) {
        logger.error('[app/move_in/submit_listing] ' + err.message);
        return reply.code(err.statusCode || 502).send({ error: err.message });
    }
};

module.exports = submit_listing;
