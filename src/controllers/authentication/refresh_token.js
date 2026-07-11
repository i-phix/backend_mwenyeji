const db = require('payservedb')
const bcrypt = require('bcryptjs');
const generate_jwt_token = require('../../utils/generate_jwt_token');
const logger = require('../../../config/winston');
const refreshToken = async (request, reply) => {

    try {
        const { refreshToken } = request.body;
        const { id } = request.params
        const Token = await db.RefreshToken.findOne({ userId: id })
        const userExist = await db.User.findById(id)
        if (Token) {
            const isMatch = await bcrypt.compare(refreshToken, Token.token);
            if (isMatch) {
                if (userExist) {
                    let user = {
                        userId: userExist._id,
                        type: userExist.type,
                        fullName: userExist.fullName,
                        email: userExist.email,
                        phoneNumber: userExist.phoneNumber,
                        role: userExist.role
                    }
                    const result = await generate_jwt_token(user, user.type)
                    logger.info(`${user.email} - token has been refreshed`);
                    return reply.code(200).send({
                        user: user,
                        authToken: result.authToken,
                        refreshToken: result.refreshToken
                    })

                }
                else {
                    logger.error('Invalid User - Refresh Token');
                    return reply.code(502).send({ error: 'Invalid user' })
                }
            }
            else {
                logger.error('Invalid Refresh Token - Refresh Token');
                return reply.code(502).send({ error: 'Invalid refresh token' })
            }
        }
        else {
            logger.error('Token not found - Refresh Token');
            return reply.code(502).send({ error: 'Token not found' })
        }
    }
    catch (err) {
        logger.error(err.message);
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = refreshToken