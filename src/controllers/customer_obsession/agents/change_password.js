const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const bcrypt = require('bcryptjs');

const change_password = async (request, reply) => {
    try {
        const agent = request.user;
        const { current_password, new_password, confirm_password } = request.body;

        console.log('=== Change Password Request ===');
        console.log('Agent:', agent.userId);

        // Validation
        if (!current_password || !new_password || !confirm_password) {
            return reply.code(400).send({
                success: false,
                error: 'Current password, new password, and confirm password are required'
            });
        }

        if (new_password !== confirm_password) {
            return reply.code(400).send({
                success: false,
                error: 'New password and confirm password do not match'
            });
        }

        if (new_password.length < 6) {
            return reply.code(400).send({
                success: false,
                error: 'New password must be at least 6 characters long'
            });
        }

        // Get user from database
        const user = await payservedb.User.findById(agent.userId);
        if (!user) {
            return reply.code(404).send({
                success: false,
                error: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(current_password, user.password);
        if (!isMatch) {
            logger.warn(`Failed password change attempt for user ${user.email} - incorrect current password`);
            return reply.code(401).send({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(new_password, 10);

        // Update password
        await payservedb.User.findByIdAndUpdate(user._id, {
            password: hashedPassword,
            updated_at: new Date()
        });

        logger.info(`Password changed successfully for user ${user.email}`);

        return reply.code(200).send({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        logger.error(`Error changing password: ${error.message}`, { stack: error.stack });

        return reply.code(500).send({
            success: false,
            error: 'Failed to change password'
        });
    }
};

module.exports = change_password;
