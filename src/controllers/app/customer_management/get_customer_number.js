const payservedb = require('payservedb');

/**
 * Fastify route handler to fetch the customer's phone number by customerId.
 */
const get_customer_phone_number = async (request, reply) => {
  const { customerId } = request.params;
  console.log("customerId:", customerId);

  try {
    const customer = await payservedb.Customer.findById(customerId);

    if (!customer) {
      console.error('Customer not found');
      return reply.code(404).send({ error: 'Customer not found' });
    }

    console.log("Customer Phone:", customer.phoneNumber);
    return reply.send({ phoneNumber: customer.phoneNumber });
  } catch (err) {
    console.error('Error fetching customer phone number:', err);
    return reply.code(500).send({ error: 'Error fetching customer phone number' });
  }
};

module.exports = get_customer_phone_number;
