const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getLevies = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
    const levyTypeModel = await getModel("LevyType", payservedb.LevyType.schema, facilityId);

    const levies = await levyModel.find({ facilityId }).populate({
      path: "levyType",
      model: levyTypeModel,
    });

    // Return empty array instead of 404 when no levies found
    return reply.code(200).send({
      success: true,
      data: levies || []  // This ensures we always send an array
    });
  } catch (err) {
    console.error('Error in getLevies:', err);
    return reply.code(400).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = getLevies;