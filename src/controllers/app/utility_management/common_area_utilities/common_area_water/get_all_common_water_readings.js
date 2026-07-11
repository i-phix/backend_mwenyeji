const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getCommonAreaWaterReadings = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { sourceType } = request.query; 

    const commonAreaWaterReadingModel = await getModel(
      'CommonAreaWaterReading', 
      payservedb.CommonAreaWaterReading.schema, 
      facilityId
    );

    // Build query object
    const query = { facilityId };
    if (sourceType) {
      query.sourceType = sourceType;
    }

    const readings = await commonAreaWaterReadingModel.find(query).sort({ date: -1 });

    return reply.code(200).send({
      message: 'Common Area Water Readings retrieved successfully',
      readings,
    });
  } catch (err) {
    console.error('Error in getCommonAreaWaterReadings:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getCommonAreaWaterReadings;