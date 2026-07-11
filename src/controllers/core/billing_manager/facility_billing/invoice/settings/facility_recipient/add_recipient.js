const payservedb = require("payservedb");

const addRecipient = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { phoneNumber, email } = request.body;

    // Validate required fields
    if (!phoneNumber || !email) {
      return reply.code(400).send({
        success: false,
        error: "Phone number and email are required",
      });
    }

    // Check if recipient already exists for this facility with same email or phone
    const existingRecipient = await payservedb.Recipient.findOne({
      facilityId,
      $or: [{ email: email.toLowerCase() }, { phoneNumber }],
    });

    if (existingRecipient) {
      return reply.code(400).send({
        success: false,
        error:
          "A recipient with this email or phone number already exists for this facility",
      });
    }

    // Create new recipient
    const newRecipient = new payservedb.Recipient({
      facilityId,
      phoneNumber,
      email: email.toLowerCase(),
    });

    await newRecipient.save();

    return reply.code(200).send({
      success: true,
      message: "Recipient added successfully",
      recipient: newRecipient,
    });
  } catch (err) {
    return reply.code(500).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = addRecipient;
