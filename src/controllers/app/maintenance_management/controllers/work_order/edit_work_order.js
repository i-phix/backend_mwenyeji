const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const editWorkOrder = async (request, reply) => {
  try {
    const { facilityId, workOrderId } = request.params;
    const {
      description,
      assigneeName,
      status,
      pricing,
      type,
      requester,
      orderNumber
    } = request.body;

    const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

    const updateFields = {
      description,
      assigneeName,
      status,
      pricing,
      type,
      requester,
      orderNumber
    };

    // Remove undefined fields to prevent overwriting with null values
    Object.keys(updateFields).forEach(key => 
      updateFields[key] === undefined && delete updateFields[key]
    );

    const updatedWorkOrder = await workOrderModel.findByIdAndUpdate(
      workOrderId,
      updateFields,
      { 
        new: true, 
        runValidators: true,
        // Add context options if needed for enum validation
        context: 'query'
      }
    );

    if (!updatedWorkOrder) {
      return reply.code(404).send({ message: 'Work order not found' });
    }

    return reply.code(200).send({
      message: 'Work order updated successfully',
      workOrder: updatedWorkOrder,
    });
  } catch (err) {
    console.error('Error in editWorkOrder:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = editWorkOrder;