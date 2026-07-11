const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_customers = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const customers = await payservedb.Customer.find({ facilityId: facilityId }).sort({_id:-1});
    // const customerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);

    // const customers = await customerModel.find({ facilityId: facilityId }).sort({_id:-1});

    return reply.code(200).send(customers);
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_customers;
