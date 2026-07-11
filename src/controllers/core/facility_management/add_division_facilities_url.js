const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const add_division_facilities_url = async (request, reply) => {
    try {
        const { id } = request.params;

        const { divisionArray } = request.body;
        console.log(divisionArray);

        const facility = await payservedb.Facility.findById(id);
        if (!facility) {
            throw new Error(`Facility doesn't exist`);
        }

        let facilityArray = facility.divisionArray;
        facilityArray = facilityArray.concat(divisionArray); // Concatenate and assign back

        let query = {
            _id: id
        };
        let data = {
            divisionArray: facilityArray
        };
        await payservedb.Facility.updateOne(query, data);

        logger.info(`Successfully added: ` + facility);
        return reply.code(200).send({ facility });

    } catch (err) {
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = add_division_facilities_url;
