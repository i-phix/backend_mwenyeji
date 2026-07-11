const payservedb = require("payservedb");

const add_default_payment_details = async (request, reply) => {
  try {
    const { shortCode, passkey, authorizationKey, module } = request.body;
    const existsing_details = await payservedb.DefaultPaymentDetails.find();

    if (!shortCode || !passkey || !authorizationKey || !module) {
      throw new Error("All fields are required");
    }

    if (existsing_details.length > 0) {
      return reply.code(409).send("Default Payment Details already exists");
    }

    const data = new payservedb.DefaultPaymentDetails({
      shortCode,
      passkey,
      authorizationKey,
      module,
    });
    await data.save();
    return reply.code(200).send({
      message: "Default Payment Details added successfully",
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_default_payment_details;
