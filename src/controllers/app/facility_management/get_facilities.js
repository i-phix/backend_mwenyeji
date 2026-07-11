const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const get_facilities = async (request, reply) => {
  try {
    const { companyId } = request.params;

    if (!companyId) {
      return reply.code(400).send({ error: 'Company ID is required' });
    }

    // Fetch the company to ensure it exists
    const companyExist = await payservedb.Company.findById(companyId);

    if (!companyExist) {
      return reply.code(403).send({ error: 'Company not found' });
    }

    // Fetch all facilities for the specified company
    const facilitiesPromises = companyExist.facilities.map(async (facilityId) => {
      return await payservedb.Facility.findById(facilityId).select('_id name location dbName');
    });

    const facilities = await Promise.all(facilitiesPromises);

    logger.info(`Facilities for company ${companyId} retrieved successfully.`);
    return reply.code(200).send({ success: true, data: facilities });
  } catch (err) {
    logger.error(`Error in get_facilities: ${err.message}`);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_facilities;
