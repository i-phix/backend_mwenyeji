const db = require('payservedb');
const logger = require('../../../../config/winston');

// POST /api/move_in/preferences/save
// Works for both guests (guestId) and authenticated users (userId from body or derived from token).
// Frontend always sends guestId; userId is set when the user is logged in.
const save_preferences = async (request, reply) => {
    try {
        const { guestId, userId, purpose, location, roomTypes, lifestyle, budgetMin, budgetMax } = request.body;

        if (!guestId && !userId) {
            return reply.code(400).send({ error: 'Either guestId or userId is required.' });
        }

        const filter = userId ? { userId } : { guestId };
        const update = {
            ...(userId && { userId }),
            ...(guestId && { guestId }),
            purpose: purpose || 'any',
            location: location || null,
            roomTypes: Array.isArray(roomTypes) ? roomTypes : [],
            lifestyle: Array.isArray(lifestyle) ? lifestyle : [],
            budgetMin: budgetMin || null,
            budgetMax: budgetMax || null,
        };

        const preference = await db.moveIn.CustomerPreference.findOneAndUpdate(
            filter,
            { $set: update },
            { upsert: true, new: true, runValidators: false }
        );

        return reply.code(200).send({ success: true, data: preference });
    } catch (err) {
        logger.error('[save_preferences] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = save_preferences;
