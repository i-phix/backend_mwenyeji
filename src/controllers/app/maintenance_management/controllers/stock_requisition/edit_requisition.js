const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const updateRequisition = async (request, reply) => {
  try {
    const { facilityId, requisitionId } = request.params;
    const { quantity, status } = request.body;

    const requisitionModel = await getModel('Requisition', payservedb.Requisition.schema, facilityId);

    const updatedRequisition = await requisitionModel.findByIdAndUpdate(
      requisitionId,
      { quantity, status },
      { new: true }
    );

    if (!updatedRequisition) {
      return reply.code(404).send({ message: 'Requisition not found' });
    }

    return reply.code(200).send({
      message: 'Requisition updated successfully',
      requisition: updatedRequisition,
    });
  } catch (err) {
    console.error('Error in updateRequisition:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = updateRequisition;
