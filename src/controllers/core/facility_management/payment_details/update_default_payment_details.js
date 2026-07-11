const payservedb = require("payservedb");

const update_default_payment_details = async (request, reply) => {
  try {
    const { id } = request.params;
    const { shortCode, passkey, authorizationKey, module } = request.body;

    const paymentDetails = await payservedb.DefaultPaymentDetails.findById(id);

    if (!paymentDetails) {
      return reply
        .code(404)
        .send({ error: "Default Payment Details not found" });
    }
    paymentDetails.shortCode = shortCode;
    paymentDetails.passkey = passkey;
    paymentDetails.authorizationKey = authorizationKey;
    paymentDetails.module = module;

    await paymentDetails.save();
    return reply.code(200).send({
      message: "Default Payment Details updated successfully",
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = update_default_payment_details;
