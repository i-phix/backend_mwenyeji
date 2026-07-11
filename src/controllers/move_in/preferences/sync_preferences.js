const db = require('payservedb');
const logger = require('../../../../config/winston');

// POST /api/move_in/preferences/sync
// Called immediately after login/register when a guestId exists in localStorage.
// Attaches the guest's saved preferences to their authenticated userId.
const sync_preferences = async (request, reply) => {
    try {
        const { guestId, userId } = request.body;

        if (!guestId || !userId) {
            return reply.code(400).send({ error: 'Both guestId and userId are required.' });
        }

        // Find the guest preference record
        const guestPreference = await db.moveIn.CustomerPreference.findOne({ guestId });

        if (!guestPreference) {
            // Nothing to sync — that's fine
            return reply.code(200).send({ success: true, synced: false });
        }

        // Check if user already has their own preference record
        const userPreference = await db.moveIn.CustomerPreference.findOne({ userId });

        if (userPreference) {
            // User record exists — only overwrite if the guest record is newer
            if (guestPreference.updatedAt > userPreference.updatedAt) {
                await db.moveIn.CustomerPreference.findOneAndUpdate(
                    { userId },
                    {
                        $set: {
                            purpose: guestPreference.purpose,
                            location: guestPreference.location,
                            roomTypes: guestPreference.roomTypes,
                            lifestyle: guestPreference.lifestyle,
                            budgetMin: guestPreference.budgetMin,
                            budgetMax: guestPreference.budgetMax,
                        }
                    },
                    { runValidators: false }
                );
            }
            // Clean up the guest record
            await db.moveIn.CustomerPreference.deleteOne({ guestId });
        } else {
            // No user record yet — just update the guest record to be owned by this user
            await db.moveIn.CustomerPreference.findOneAndUpdate(
                { guestId },
                { $set: { userId, guestId: null } },
                { runValidators: false }
            );
        }

        return reply.code(200).send({ success: true, synced: true });
    } catch (err) {
        logger.error('[sync_preferences] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = sync_preferences;
