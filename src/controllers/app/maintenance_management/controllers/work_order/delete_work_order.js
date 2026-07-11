const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteWorkOrder = async (request, reply) => {
  try {
    const { facilityId, workOrderId } = request.params;

    const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

    const deletedWorkOrder = await workOrderModel.findByIdAndDelete(workOrderId);

    if (!deletedWorkOrder) {
      return reply.code(404).send({ message: 'Work order not found' });
    }

    return reply.code(200).send({ message: 'Work order deleted successfully' });
  } catch (err) {
    console.error('Error in deleteWorkOrder:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = deleteWorkOrder;
