const payservedb = require('payservedb');
const Joi = require('joi');
const { getModel } = require('../../../../../utils/getModel');

const addRequisition = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { spareOrStockId, vendorId, quantity, status } = request.body;

    const requisitionModel = await getModel('Requisition', payservedb.Requisition.schema, facilityId);

    const newRequisition = await requisitionModel.create({
      facilityId,
      spareOrStockId,
      vendorId,
      quantity,
      status,
    });

    return reply.code(200).send({
      message: 'Requisition added successfully',
      requisition: newRequisition,
    });
  } catch (err) {
    console.error('Error in addRequisition:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addRequisition;
