const payservedb = require("payservedb");

const updateRecipient = async (request, reply) => {
  try {
    const { facilityId, recipientId } = request.params;
    const { phoneNumber, email } = request.body;

    // Validate that at least one field is provided
    if (!phoneNumber && !email) {
      return reply.code(400).send({
        success: false,
        error:
          "At least one field (phoneNumber or email) is required for update",
      });
    }

    // Check if recipient exists
    const existingRecipient = await payservedb.Recipient.findOne({
      _id: recipientId,
      facilityId,
    });

    if (!existingRecipient) {
      return reply.code(404).send({
        success: false,
        error: "Recipient not found",
      });
    }

    // Check for duplicates if email or phone is being updated
    const updateData = {};
    if (email) {
      const duplicateEmail = await payservedb.Recipient.findOne({
        facilityId,
        email: email.toLowerCase(),
        _id: { $ne: recipientId },
      });

      if (duplicateEmail) {
        return reply.code(400).send({
          success: false,
          error:
            "Another recipient with this email already exists for this facility",
        });
      }
      updateData.email = email.toLowerCase();
    }

    if (phoneNumber) {
      const duplicatePhone = await payservedb.Recipient.findOne({
        facilityId,
        phoneNumber,
        _id: { $ne: recipientId },
      });

      if (duplicatePhone) {
        return reply.code(400).send({
          success: false,
          error:
            "Another recipient with this phone number already exists for this facility",
        });
      }
      updateData.phoneNumber = phoneNumber;
    }

    // Update the recipient
    const updatedRecipient = await payservedb.Recipient.findByIdAndUpdate(
      recipientId,
      updateData,
      { new: true, runValidators: true },
    );

    return reply.code(200).send({
      success: true,
      message: "Recipient updated successfully",
      recipient: updatedRecipient,
    });
  } catch (err) {
    return reply.code(500).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = updateRecipient;
