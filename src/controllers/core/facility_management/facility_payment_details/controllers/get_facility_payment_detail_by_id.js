const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const mongoose = require("mongoose");

const get_facility_payment_detail_by_id = async (request, reply) => {
  try {
    const { id, facilityId } = request.params;

    if (!id) {
      return reply.code(400).send({
        success: false,
        error: "Payment detail ID is required",
      });
    }

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    // Log the IDs we're trying to find for debugging
    console.log(
      `Searching for payment detail with ID: ${id} in facility: ${facilityId}`,
    );

    // Verify if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({
        success: false,
        error: "Invalid payment detail ID format",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(facilityId)) {
      return reply.code(400).send({
        success: false,
        error: "Invalid facility ID format",
      });
    }

    // Get the facility-specific model using the facilityId
    const paymentModel = await getModel(
      "FacilityPaymentDetails",
      payservedb.FacilityPaymentDetails.schema,
      facilityId,
    );

    // Find the payment detail by ID within the specific facility's collection
    const paymentDetail = await paymentModel.findById(id);

    if (!paymentDetail) {
      console.log(
        `Payment detail with ID: ${id} not found in facility: ${facilityId}`,
      );
      return reply.code(404).send({
        success: false,
        error: "Payment detail not found",
      });
    }

    console.log(
      `Found payment detail with ID: ${id} in facility: ${facilityId}`,
    );

    return reply.code(200).send({
      success: true,
      data: paymentDetail,
    });
  } catch (err) {
    console.error("Error fetching payment detail:", err);
    return reply.code(502).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = get_facility_payment_detail_by_id;
