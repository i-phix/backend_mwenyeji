const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const update_payment_details = async (request, reply) => {
  try {
    const { _id, facility, shortCode, passkey, authorizationKey, module } =
      request.body;

    if (!_id) {
      return reply.code(400).send({
        success: false,
        error: "Payment detail ID is required"
      });
    }

    if (!shortCode || !module) {
      return reply.code(400).send({
        success: false,
        error: "Short code and module are required fields"
      });
    }

    const facilityId = facility;
    const paymentModel = await getModel(
      "FacilityPaymentDetails",
      payservedb.FacilityPaymentDetails.schema,
      facilityId
    );

    // First, find the existing payment detail to get current values
    const existingPaymentDetail = await paymentModel.findById(_id);

    if (!existingPaymentDetail) {
      return reply.code(404).send({
        success: false,
        error: "Payment detail not found"
      });
    }

    // Prepare update data
    const updateData = {
      shortCode,
      module,
      // Only update sensitive fields if provided
      ...(passkey && { passkey }),
      ...(authorizationKey && { authorizationKey })
    };

    const updatedPaymentDetails = await paymentModel.findByIdAndUpdate(
      _id,
      updateData,
      { new: true }
    );

    if (!updatedPaymentDetails) {
      return reply.code(404).send({
        success: false,
        error: "Failed to update payment details"
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Payment details updated successfully",
      data: {
        _id: updatedPaymentDetails._id,
        shortCode: updatedPaymentDetails.shortCode,
        module: updatedPaymentDetails.module
        // Not returning sensitive information
      }
    });
  } catch (err) {
    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = update_payment_details;