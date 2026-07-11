const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_levy_types = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Retrieve the LevyType model for the specified facilityId
    const levyTypeModel = await getModel(
      "LevyType",
      payservedb.LevyType.schema,
      facilityId
    );

    // Find all levy types for the given facility
    const levyTypes = await levyTypeModel.find({ facilityId });

    // Return empty array instead of 404 when no levy types found
    return reply.code(200).send({
      success: true,
      data: levyTypes || []  // This ensures we always send an array
    });
  } catch (err) {
    console.error('Error in getLevyTypes:', err);
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = get_levy_types;