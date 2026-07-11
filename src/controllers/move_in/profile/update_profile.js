const db = require('payservedb');
const logger = require('../../../../config/winston');

// PUT /api/move_in/profile
// JWT userId is MoveInUser._id (issued by /api/move_in/auth/login).
const update_profile = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { firstName, lastName, phone, nationalId, occupation, emergencyContactName, emergencyContactPhone } = request.body;

        const update = {};
        if (firstName?.trim() || lastName?.trim()) {
            const full = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ');
            if (full) update.fullName = full;
        }
        if (phone?.trim())                   update.phoneNumber            = phone.trim();
        if (nationalId?.trim())              update.nationalId             = nationalId.trim();
        if (occupation?.trim())              update.occupation             = occupation.trim();
        if (emergencyContactName?.trim())    update.emergencyContactName   = emergencyContactName.trim();
        if (emergencyContactPhone?.trim())   update.emergencyContactPhone  = emergencyContactPhone.trim();

        const updated = await db.moveIn.MoveInUser.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true }
        ).select('-password').lean();

        if (!updated) return reply.code(404).send({ error: 'Profile not found.' });

        return reply.code(200).send({ success: true, message: 'Profile updated.', data: updated });
    } catch (err) {
        logger.error('[move_in/profile/update] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_profile;
