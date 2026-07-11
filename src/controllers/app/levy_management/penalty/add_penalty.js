const payservedb = require("payservedb");
const { getModel } = require('../../../../utils/getModel');

const add_penalty = async (request, reply) => {
  try {
    const { name, type, effectDays, percentage, amount, isActive, levyId, module } = request.body;
    console.log(request.body);
    const { facilityId } = request.params;

    // Modified validation to be more flexible
    if (!name || !type || !effectDays || !isActive || !levyId || !module) {
      return reply
        .code(400)
        .send({ error: "Missing required fields in request body" });
    }

    // Additional type-specific validation
    if (type === 'fixed' && (amount === undefined || amount === null || amount === '')) {
      return reply
        .code(400)
        .send({ error: "Amount is required for fixed type penalties" });
    }

    if (type === 'percentage' && (percentage === undefined || percentage === null || percentage === '')) {
      return reply
        .code(400)
        .send({ error: "Percentage is required for percentage-based penalties" });
    }

    // Format amount - allow null for percentage type
    const formattedAmount = type === 'fixed'
      ? (amount === "" ? null : amount)
      : null;

    // Get the penalty model
    const penaltyModel = await getModel("Penalty", payservedb.Penalty.schema, facilityId);

    // Check if a penalty with the same name already exists
    const penaltyExist = await penaltyModel.findOne({ name });

    if (penaltyExist) {
      throw new Error("Penalty already exists.");
    } else {
      // Create a new penalty object
      let data = new penaltyModel({
        facilityId,
        name,
        type,
        effectDays,
        percentage: type === 'percentage' ? percentage : null,
        amount: formattedAmount,
        isActive,
        levyId,
        module
      });

      // Save the new penalty to the database
      const response = await data.save();

      // Return a success response
      return reply.code(200).send({ message: "Penalty has been added." });
    }
  } catch (err) {
    // Handle errors and send error response
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_penalty;
