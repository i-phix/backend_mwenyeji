const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const add_payment_details = async (request, reply) => {
  try {
    const { facility, shortCode, passkey, authorizationKey, module } =
      request.body;

    if (!facility || !shortCode || !passkey || !authorizationKey || !module) {
      return reply.code(400).send("Please fill all the required fields");
    }

    const facilityId = facility;

    const paymentModel = await getModel(
      "FacilityPaymentDetails",
      payservedb.FacilityPaymentDetails.schema,
      facilityId
    );

    // Check if payment details for this module already exist
    const existingDetails = await paymentModel.findOne({ module });

    if (existingDetails) {
      return reply.code(409).send({
        message: "Payment details for this module already exist and cannot be added again"
      });
    }

    // If we reach here, no payment details exist for this module, so create them
    const savedData = await paymentModel.create({
      facility,
      shortCode,
      passkey,
      authorizationKey,
      module,
    });

    return reply.code(200).send({
      message: "Facility payment details added successfully",
      details: savedData,
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_payment_details;