const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');
const { getModel } = require('../../../../utils/getModel');

const get_facility_guards = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.code(400).send({ error: 'Facility ID is required' });
    }

    // const facility = await payservedb.Facility.findById(facilityId);
    const facilityModel = await getModel('Facility', payservedb.Facility.schema, facilityId);
    const facility = facilityModel.findById(facilityId);

    if (!facility) {
      return reply.code(404).send({ error: 'Facility not found' });
    } 

    const guardModel = await getModel('Guard', payservedb.Guard.schema, facilityId);

    const guard = await guardModel.find({ facilityId: facilityId })

    return reply.code(200).send(guard);
  } catch (err) {
    logger.error(`Error in get_access_points_for_facility: ${err.message}`);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_facility_guards;
