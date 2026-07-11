const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getAllWorkOrders = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

    const workOrders = await workOrderModel.find();

    return reply.code(200).send(workOrders);
  } catch (err) {
    console.error('Error in getAllWorkOrders:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getAllWorkOrders;
