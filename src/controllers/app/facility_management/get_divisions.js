const payservedb = require('payservedb');

const getDivisionArray = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        // Find the facility by ID and project only the 'divisionArray' field
        const facility = await payservedb.Facility.findById(facilityId).select('divisionArray');
        // Return only the divisionArray
        return reply.code(200).send(facility.divisionArray);
    } catch (err) {
        console.log(err);
        return reply.code(502).send({ error: err.message });
    };
};

module.exports = getDivisionArray;
