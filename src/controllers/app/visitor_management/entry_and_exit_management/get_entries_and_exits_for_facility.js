const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');
const { getModel } = require('../../../../utils/getModel');

const get_access_points_for_facility = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.code(400).send({ error: 'Facility ID is required' });
    }

    const facility = await payservedb.Facility.findById(facilityId);

    if (!facility) {
      return reply.code(404).send({ error: 'Facility not found' });
    }

    const entryExitModel = await getModel('EntryExit', payservedb.EntryExit.schema, facilityId);


    const access = await entryExitModel.find({ facilityId: facilityId })

    return reply.code(200).send(access);
  } catch (err) {
    logger.error(`Error in get_access_points_for_facility: ${err.message}`);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_access_points_for_facility;
