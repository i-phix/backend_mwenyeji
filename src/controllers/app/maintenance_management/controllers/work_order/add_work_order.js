const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const addWorkOrder = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      requester,
      description,
      pricing,
      status,
      type,
      orderNumber
    } = request.body;

    const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

    const savedWorkOrder = await workOrderModel.create({
      facilityId,
      requester,
      description,
      pricing,
      status,
      type,
      orderNumber
    });

    return reply.code(200).send({
      message: 'Work order created successfully',
      workOrder: savedWorkOrder,
    });
  } catch (err) {
    console.error('Error in addWorkOrder:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addWorkOrder;
