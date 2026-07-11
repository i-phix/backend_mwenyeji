const logger = require("../../../config/winston");
const db = require('payservedb')

const verify_otp = async (request, reply) => {
    try {
        const { userName, code } = request.body;

        const isPhoneNumber = /^[0-9]+$/.test(userName);
        const searchUserName = isPhoneNumber ? userName.slice(-9) : userName;

        console.log("Searching with:", searchUserName);
        
        const userExist = await db.User.findOne({ 
            $or: [{ email: userName }, { phoneNumber: searchUserName }]
        })
        if (userExist) {
            if (new Date(userExist.verificationExpiration) <= new Date()) {
                throw new Error('Verification code has expired')
            }
            if (parseInt(userExist.verificationCode) !== parseInt(code)) {
                throw new Error('Invalid verification code')
            }
            if (parseInt(userExist.verificationCode) === parseInt(code)) {
                logger.info('Successfully verified otp.')
                return reply.code(200).send('Successfully verified otp')
            }
        }
        else {
            throw new Error('User not found')
        }

    }
    catch (err) {
        logger.error(err.message)
        return reply.code(502).send({ error: err.message })
    }
}

module.exports = verify_otp