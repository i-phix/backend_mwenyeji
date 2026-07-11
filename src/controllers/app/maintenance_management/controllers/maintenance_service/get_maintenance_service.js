const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getMaintenanceServiceById = async (request, reply) => {
  try {
    const { facilityId, serviceId } = request.params;

    const serviceModel = await getModel('MaintenanceService', payservedb.MaintenanceService.schema, facilityId);

    const maintenanceService = await serviceModel.findById(serviceId);

    if (!maintenanceService) {
      return reply.code(404).send({ message: 'Maintenance Service not found' });
    }

    return reply.code(200).send(maintenacneService);
  } catch (err) {
    console.error('Error in getMaintenanceServiceById:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getMaintenanceServiceById;