const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const confirm_user_email = async (request, reply) => {
    try {
        const { email } = request.params
        const userExist = await payservedb.User.findOne({ email: email });
        if (userExist) {
            logger.info("User exists ")
            return reply.code(200).send({ message: "User exist", userExist })
        }
        else {
            throw new Error("User doesn't exist")
        }

    }
    catch (err) {
        logger.error(err.message)
        return reply.code(502).send({ error: err.message })

    }
}
module.exports = confirm_user_email