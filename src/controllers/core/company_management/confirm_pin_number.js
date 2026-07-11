const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const confirm_pin_number = async (request, reply) => {
    try {
        const { companyPinNumber } = request.params
    
        const companyPinNumberExist = await payservedb.Company.findOne({ companyPinNumber: companyPinNumber });
    
        if (companyPinNumberExist) {
            logger.info("Company Pin Number exists ")
            return reply.code(200).send("Company Pin Number exists ")
        }
        else {
            throw new Error("Company Pin Number doesn't exist")
        }

    }
    catch (err) {
        logger.error(err.message)
        return reply.code(502).send({ error: err.message })

    }
}
module.exports = confirm_pin_number