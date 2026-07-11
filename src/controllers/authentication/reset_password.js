const db = require('payservedb')
const bcrypt = require('bcryptjs');
const logger = require("../../../config/winston");
const { resetPasswordValidator } = require("../../utils/validator");

const reset_password = async (request, reply) => {
    try {
        console.log('=== Reset Password Request ===');
        console.log('Request body:', request.body);
        console.log('Request params:', request.params);

        const validationResults = await resetPasswordValidator.validate(request.body);
        if (validationResults.error) {
            logger.error(validationResults.error.details[0].message);
            return reply.code(400).send({ error: validationResults.error.details[0].message });
        }
        const { password, confirm_password } = validationResults.value;
        if (password !== confirm_password) {
            return reply.code(500).send({ error: 'Passwords do not match' });
        }
        const { id } = request.params
        console.log('User ID from params:', id)
        const userExist = await db.User.findById(id);
        console.log('User found:', userExist ? `Yes (${userExist.email})` : 'No');

        if (userExist) {
            const saltRounds = 10;
            const salt = await bcrypt.genSalt(saltRounds);
            const hash = await bcrypt.hash(password, salt);
            let query = {
                _id: userExist._id
            }
            let data = {}
            data.password = hash;

            console.log('About to update password for user:', userExist._id);
            console.log('Update query:', query);
            console.log('New password hash:', hash.substring(0, 20) + '...');

            const updateResult = await db.User.updateOne(query, data)

            console.log('Password update result:', updateResult);
            console.log('Matched count:', updateResult.matchedCount);
            console.log('Modified count:', updateResult.modifiedCount);

            if (updateResult.modifiedCount === 0) {
                logger.error(`Failed to update password for user ${userExist._id}`);
                return reply.code(500).send({ error: 'Failed to update password' });
            }

            // Verify the password was actually updated
            const updatedUser = await db.User.findById(userExist._id);
            console.log('Verification - User password hash after update:', updatedUser.password.substring(0, 20) + '...');
            console.log('Verification - Password hashes match:', updatedUser.password === hash);

            logger.info(`Password updated successfully for user ${userExist._id}`);
            return reply.code(200).send('Password updated successfully')
        } else {
            logger.error(`User not found with id: ${id}`);
            return reply.code(404).send({ error: 'User not found' });
        }
    }
    catch (err) {
        logger.error(err.message)
        return reply.code(502).send({ error: err.message })
    }

}
module.exports = reset_password