const db = require('payservedb');
const bcrypt = require('bcryptjs');
const generate_jwt_token = require('../../../utils/generate_jwt_token');
const logger = require('../../../../config/winston');

// POST /api/move_in/auth/login
// Authenticates a MoveInUser (tenant) from payserve_movein database.
const login_user = async (request, reply) => {
    try {
        const { email, password } = request.body;

        if (!email || !password) {
            return reply.code(400).send({ error: 'Email and password are required.' });
        }

        const user = await db.moveIn.MoveInUser.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return reply.code(403).send({ error: 'Email or password is invalid.' });
        }

        if (!user.isEnabled) {
            return reply.code(403).send({ error: 'Your account has been suspended. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return reply.code(401).send({ error: 'Email or password is invalid.' });
        }

        const payload = {
            userId: user._id,
            type: 'MoveInUser',
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            source: 'movein',
        };

        const result = await generate_jwt_token(payload, 'MoveInUser');

        logger.info(`[move_in] Tenant logged in: ${user.email}`);

        return reply.code(200).send({
            success: true,
            user: payload,
            authToken: result.authToken,
            refreshToken: result.refreshToken,
        });
    } catch (err) {
        logger.error('[move_in/login] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = login_user;
