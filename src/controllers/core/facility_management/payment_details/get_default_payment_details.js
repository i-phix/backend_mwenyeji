const payservedb = require("payservedb");

const get_default_payment_details = async (request, reply) => {
  try {
    const defaultPaymentDetails = await payservedb.DefaultPaymentDetails.find();
    return reply.code(200).send(defaultPaymentDetails);
    if (!defaultPaymentDetails) {
      throw new Error("Default Payment Details not found");
    }
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_default_payment_details;
