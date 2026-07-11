const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const get_facility_payment_details = async (request, reply) => {
  try {
    const { id } = request.params;

    const facilityId = id;

    const paymentModel = await getModel(
      "FacilityPaymentDetails",
      payservedb.FacilityPaymentDetails.schema,
      facilityId
    );
    const paymentDetails = await paymentModel.find({
      facility: facilityId,
    });

    if (!paymentDetails) {
      return reply.code(404).send("Facility payment details not found");
    }

    return reply.code(200).send(paymentDetails);
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_facility_payment_details;
