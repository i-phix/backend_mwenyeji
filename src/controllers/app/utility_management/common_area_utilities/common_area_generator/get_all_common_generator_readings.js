const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getCommonAreaGeneratorReadings = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { startDate, endDate } = request.query; 

    const commonAreaGeneratorReadingModel = await getModel(
      'CommonAreaGeneratorReading', 
      payservedb.CommonAreaGeneratorReading.schema, 
      facilityId
    );

    // Build query object
    const query = { facilityId };
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const readings = await commonAreaGeneratorReadingModel.find(query).sort({ date: -1 });

    return reply.code(200).send({
      message: 'Common Area Generator Readings retrieved successfully',
      readings,
    });
  } catch (err) {
    console.error('Error in getCommonAreaGeneratorReadings:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getCommonAreaGeneratorReadings;