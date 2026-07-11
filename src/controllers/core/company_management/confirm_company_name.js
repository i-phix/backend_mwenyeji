const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const confirm_company_name = async (request, reply) => {
    try {
        const { name } = request.params
    
        const companyExist = await payservedb.Company.findOne({ name: name });
    
        if (companyExist) {
            logger.info("Company exists ")
            return reply.code(200).send("Company exists ")
        }
        else {
            throw new Error("Company doesn't exist")
        }

    }
    catch (err) {
        console.log(err)
        logger.error(err.message)
        return reply.code(502).send({ error: err.message })

    }
}
module.exports = confirm_company_name