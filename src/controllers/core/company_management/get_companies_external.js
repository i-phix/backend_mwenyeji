const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const get_companies_external = async (request, reply) => {
    try {
        const companies = await payservedb.Company.find({});
        logger.info(`Successfully extracted companies: `+companies);
        return reply.code(200).send(companies)
    }
    catch (err) {
        logger.error(err.message)
        console.log(err)
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = get_companies_external