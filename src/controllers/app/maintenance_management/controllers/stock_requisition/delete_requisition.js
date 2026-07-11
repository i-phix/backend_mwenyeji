const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteRequisition = async (request, reply) => {
  try {
    const { facilityId, requisitionId } = request.params;

    const requisitionModel = await getModel('Requisition', payservedb.Requisition.schema, facilityId);

    const deletedRequisition = await requisitionModel.findByIdAndDelete(requisitionId);

    if (!deletedRequisition) {
      return reply.code(404).send({ message: 'Requisition not found' });
    }

    return reply.code(200).send({
      message: 'Requisition deleted successfully',
      requisition: deletedRequisition,
    });
  } catch (err) {
    console.error('Error in deleteRequisition:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = deleteRequisition;
