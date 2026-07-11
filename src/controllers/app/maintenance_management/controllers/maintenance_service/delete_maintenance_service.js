const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteMaintenanceService = async (request, reply) => {
  try {
    const { facilityId, serviceId } = request.params;

    const serviceModel = await getModel('MaintenanceService', payservedb.MaintenanceService.schema, facilityId);

    const deletedService = await serviceModel.findByIdAndDelete(serviceId);

    if (!deletedService) {
      return reply.code(404).send({ message: 'Maintenance service not found' });
    }

    return reply.code(200).send({
      message: 'Maintenance service deleted successfully',
      service: deletedService,
    });
  } catch (err) {
    console.error('Error in deleteMaintenanceService:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = deleteMaintenanceService;
