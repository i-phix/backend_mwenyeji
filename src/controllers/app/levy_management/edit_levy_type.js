const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const editLevyType = async (request, reply) => {
  try {
    const { facilityId, levyTypeId } = request.params;
    const { name } = request.body;

    const levyTypeModel = await getModel("LevyType", payservedb.LevyType.schema, facilityId);
    
    const updatedLevyType = await levyTypeModel.findByIdAndUpdate(
      levyTypeId,
      { name },
      { new: true }
    );

    if (!updatedLevyType) {
      return reply.code(404).send({ error: 'Levy type not found' });
    }

    return reply.code(200).send({
      success: true,
      data: updatedLevyType
    });
  } catch (err) {
    console.error('Error in editLevyType:', err);
    return reply.code(400).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = editLevyType;