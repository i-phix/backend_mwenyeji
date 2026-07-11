const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getRequisitionById = async (request, reply) => {
  try {
    const { facilityId, requisitionId } = request.params;

    const requisitionModel = await getModel('Requisition', payservedb.Requisition.schema, facilityId);

    const requisition = await requisitionModel.findById(requisitionId);

    if (!requisition) {
      return reply.code(404).send({ message: 'Requisition not found' });
    }

    return reply.code(200).send(requisition);
  } catch (err) {
    console.error('Error in getRequisitionById:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getRequisitionById;