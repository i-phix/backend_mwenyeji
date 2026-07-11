const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getCommonAreaElectricityReadings = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { location } = request.query; // Optional filter by location

    const commonAreaElectricityReadingModel = await getModel(
      'CommonAreaElectricityReading', 
      payservedb.CommonAreaElectricityReading.schema, 
      facilityId
    );

    // Build query object
    const query = { facilityId };
    if (location) {
      query.location = location;
    }

    const readings = await commonAreaElectricityReadingModel.find(query).sort({ date: -1 });

    return reply.code(200).send({
      message: 'Common Area Electricity Readings retrieved successfully',
      readings,
    });
  } catch (err) {
    console.error('Error in getCommonAreaElectricityReadings:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getCommonAreaElectricityReadings;