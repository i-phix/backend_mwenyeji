const payservedb = require("payservedb");
const { getModel } = require('../../../../utils/getModel');

const update_penalty_status = async (request, reply) => {
  try {
    console.log("update_penalty_status");
    const { isActive } = request.body;
    const { facilityId, penaltyId } = request.params;

    if (penaltyId === undefined || penaltyId === null) {
      return reply
        .code(400)
        .send({ error: "Penalty ID is required" });
    }

    if (isActive === undefined || isActive === null) {
      return reply
        .code(400)
        .send({ error: "New status (isActive) is required" });
    }

    // Get the penalty model for the given facilityId
    const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

    // Find the penalty by penaltyId
    const penalty = await penaltyModel.findOne({ _id: penaltyId, facilityId });

    if (!penalty) {
      return reply
        .code(404)
        .send({ error: "Penalty not found" });
    }

    // Update the penalty status
    penalty.isActive = isActive;

    // Save the updated penalty object
    const updatedPenalty = await penalty.save();

    // Return success response
    return reply.code(200).send({
      message: "Penalty status updated successfully",
      updatedPenalty
    });
  } catch (err) {
    // Handle errors and send error response
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = update_penalty_status;

