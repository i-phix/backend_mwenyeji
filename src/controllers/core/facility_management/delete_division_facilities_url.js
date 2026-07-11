const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const delete_division_facilities_url = async (request, reply) => {
    try {
        const { id } = request.params;
        const { divisions} = request.body
        const facility = await payservedb.Facility.findById(id);
        if (!facility) {
            throw new Error(`Facility doesn't exist`);
        }
        let query = {
            _id: id
        }
        let data = {
            divisionArray: divisions
        }
        await payservedb.Facility.updateOne(query,data)

        logger.info(`Successfully deleted deivision in facility: ` + facility);
        return reply.code(200).send({ facility });


    }
    catch (err) {
        logger.error(err.message)
        console.log(err)
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = delete_division_facilities_url