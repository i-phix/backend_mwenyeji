const payservedb = require("payservedb");

const deleteRecipient = async (request, reply) => {
  try {
    const { facilityId, recipientId } = request.params;

    // Find and delete the recipient
    const deletedRecipient = await payservedb.Recipient.findOneAndDelete({
      _id: recipientId,
      facilityId,
    });

    if (!deletedRecipient) {
      return reply.code(404).send({
        success: false,
        error: "Recipient not found",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Recipient deleted successfully",
      recipient: deletedRecipient,
    });
  } catch (err) {
    return reply.code(500).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = deleteRecipient;
