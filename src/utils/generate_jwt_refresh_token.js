const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('payservedb')
const logger = require('../../config/winston');
async function generateRefreshToken(userExist) {
    try {
        const refreshTokenLength = 64;
        const refreshToken = crypto.randomBytes(refreshTokenLength).toString('hex');
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(refreshToken, salt);
        await storeRefreshTokenInDatabase(userExist._id, hash);
        logger.info(`Successfully generated refresh token.`)
        return refreshToken;
    }
    catch (err) {
        logger.error(`Error generating refresh token: ${err}`)
    }
}
async function storeRefreshTokenInDatabase(userId, hash) {
    try {
        const refreshTokenExist = await db.RefreshToken.findOne({ userId: userId });

        if (!refreshTokenExist) {
            const data = new db.RefreshToken({
                userId: userId,
                token: hash
            })
            const result = await data.save();
            logger.info('Refresh Token Saved Successfully: ' + result)
        }
        else {
            const query = {
                _id: refreshTokenExist.id
            }
            const data = {
                token: hash
            }
            const result = await db.RefreshToken.updateOne(query, data)
            let object = {
                refreshTokenExist,
                updatedData: { ...data }
            }
            logger.info('Refresh Token Updated Successfully: ' + object)
        }
    }
    catch (err) {
        logger.error(err.message)
    }
}
module.exports = generateRefreshToken
