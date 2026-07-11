const payservedb = require('payservedb');

const { getModel } = require('../../../../../utils/getModel');

const updateMaintenanceService = async (request, reply) => {
  try {
    const { facilityId, serviceId } = request.params;
    const { name } = request.body;

    const serviceModel = await getModel('MaintenanceService', payservedb.MaintenanceService.schema, facilityId);

    const updatedService = await serviceModel.findByIdAndUpdate(
      serviceId,
      { name },
      { new: true }
    );

    if (!updatedService) {
      return reply.code(404).send({ message: 'Maintenance service not found' });
    }

    return reply.code(200).send({
      message: 'Maintenance service updated successfully',
      service: updatedService,
    });
  } catch (err) {
    console.error('Error in updateMaintenanceService:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = updateMaintenanceService;
