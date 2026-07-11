const payservedb = require('payservedb');
const { getModel } = require("../../../utils/getModel");

const get_units_by_customer = async (request, reply) => {
  try {
    const { facilityId, customerId } = request.params;

    const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);

    const units = await unitModel.find({
      $or: [
        { homeOwnerId: customerId },
        { tenantId: customerId }
      ]
    });

    return reply.code(200).send(units);
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_units_by_customer;
