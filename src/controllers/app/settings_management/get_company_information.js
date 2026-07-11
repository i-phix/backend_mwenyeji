const payservedb = require('payservedb');

const CompanyInformation = async (request, reply) => {
    try {

        //This endpoint has been refactored to fetch the biller address for display in the invoice page.
        const { facilityId } = request.params;

        // Find the facility by facilityId
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({ error: 'Facility not found' });
        }

        // Find the company that owns this facility
        const company = await payservedb.Company.findOne({ facilities: facilityId });
        if (!company) {
            return reply.code(404).send({ error: 'Company not found for this facility' });
        }

        return reply.code(200).send(company);
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = CompanyInformation