const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const fetchAllMaintenanceServices = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const serviceModel = await getModel('MaintenanceService', payservedb.MaintenanceService.schema, facilityId);

    const services = await serviceModel.find();

    return reply.code(200).send({ services });
  } catch (err) {
    console.error('Error in fetchAllMaintenanceServices:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = fetchAllMaintenanceServices;
