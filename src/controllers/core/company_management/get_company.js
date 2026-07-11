const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const get_company = async (request, reply) => {
    try {
        const { id } = request.params;
        const company = await payservedb.Company.findById(id);
        if (!company) {
            throw new Error(`Company doesn't exist`);
        }

        let facilities = await Promise.all(
            company.facilities.map(async (item) => {
                const facility = await payservedb.Facility.findById(item);
                return facility;
            })
        );

        logger.info(`Successfully extracted company: ` + company);
        return reply.code(200).send({ company, facilities });


    }
    catch (err) {
        logger.error(err.message)
        console.log(err)
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = get_company