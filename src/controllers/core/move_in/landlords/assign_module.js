const db = require('payservedb');
const logger = require('../../../../../config/winston');

// POST /api/core/move_in/landlords/assign
// Assigns the Move-In module to an existing payserve_property Landlord.
// Creates a MoveInLandlord record in payserve_movein DB.
const assign_module = async (request, reply) => {
    try {
        const { userId: adminId } = request.user;
        const { landlordId } = request.body;

        if (!landlordId) {
            return reply.code(400).send({ error: 'landlordId is required.' });
        }

        // Verify the landlord exists in payserve_property
        const landlord = await db.User.findById(landlordId).select('fullName email type').lean();
        if (!landlord) {
            return reply.code(404).send({ error: 'Landlord not found.' });
        }
        if (landlord.type !== 'Landlord') {
            return reply.code(400).send({ error: 'User is not a Landlord.' });
        }

        // Check if already assigned
        const existing = await db.moveIn.MoveInLandlord.findOne({ landlordId });
        if (existing) {
            if (existing.isEnabled) {
                return reply.code(409).send({ error: 'Landlord already has Move-In module access.' });
            }
            // Re-enable if previously revoked
            existing.isEnabled = true;
            existing.assignedBy = adminId;
            existing.assignedAt = new Date();
            existing.revokedAt = null;
            await existing.save();
            logger.info(`[core/move_in] Module re-enabled for landlord ${landlordId} by ${adminId}`);
            return reply.code(200).send({ success: true, message: 'Move-In module access restored.' });
        }

        const record = new db.moveIn.MoveInLandlord({
            landlordId,
            assignedBy: adminId,
            assignedAt: new Date(),
            isEnabled: true,
        });
        await record.save();

        logger.info(`[core/move_in] Module assigned to landlord ${landlordId} by ${adminId}`);
        return reply.code(200).send({
            success: true,
            message: 'Move-In module access granted.',
            data: { landlordId, landlordName: landlord.fullName, landlordEmail: landlord.email },
        });
    } catch (err) {
        logger.error('[core/move_in/landlords/assign] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = assign_module;
