const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const get_company_users = async (request, reply) => {
    try {
        const users = await payservedb.User.find({ type: 'Company' });
        logger.info("List of users ")
        return reply.code(200).send(users)
    }
    catch (err) {
        logger.error(err.message)
        return reply.code(502).send({ error: err.message })

    }
}
module.exports = get_company_users