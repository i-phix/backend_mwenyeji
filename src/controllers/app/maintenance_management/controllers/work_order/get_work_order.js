const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getWorkOrderById = async (request, reply) => {
  try {
    const { facilityId, workOrderId } = request.params;

    const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

    const workOrder = await workOrderModel.findById(workOrderId);

    if (!workOrder) {
      return reply.code(404).send({ message: 'Work order not found' });
    }

    return reply.code(200).send(workOrder);
  } catch (err) {
    console.error('Error in getWorkOrderById:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getWorkOrderById;