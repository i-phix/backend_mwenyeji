const payservedb = require('payservedb');
const { companyValidator } = require('../../../utils/validator');
const logger = require('../../../../config/winston');

const update_company = async (request, reply) => {
    try {
        const validationResults = await companyValidator.validate(request.body)
        if (validationResults.error) {
            logger.error(validationResults.error.details[0].message);
            console.log(validationResults.error.details[0])
            return reply.code(400).send({ error: validationResults.error.details[0].message });
        }
        const { name } = validationResults.value;
        const { id } = request.params
        const companyExist = await payservedb.Company.findOne({ name: name, _id: { $ne: id } });
        if (companyExist) {
            throw new Error('A company with the same name already exists.')
            return reply.code(409).send({ error: 'A company with the same name already exists.' });
        }
        let query = {
            _id: id
        }
        let data = {
            name: name
        }
        const result = await payservedb.Company.updateOne(query,data)
        
        logger.info("Company name updated successfully. " + result)
        return reply.code(200).send(result)
    }
    catch (err) {
        logger.error(err.message)
        console.log(err)
        return reply.code(502).send({ error: err.message })

    }
}
module.exports = update_company