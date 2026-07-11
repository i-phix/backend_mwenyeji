const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const fetchAllRequisitions = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const requisitionModel = await getModel('Requisition', payservedb.Requisition.schema, facilityId);

    const requisitions = await requisitionModel.find()
      .populate('spareOrStockId')
      .populate('vendorId');

    return reply.code(200).send({ requisitions });
  } catch (err) {
    console.error('Error in fetchAllRequisitions:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = fetchAllRequisitions;
