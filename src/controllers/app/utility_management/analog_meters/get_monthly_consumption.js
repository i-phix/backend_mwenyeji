const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getMonthlyConsumption = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    
    // Get the facility-specific model
    const analogMeterModel = await getModel('WaterMeter', payservedb.WaterMeter.schema, facilityId);
    
    // Get the current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // Get meters with readings in the current month
    const metersWithReadings = await analogMeterModel.find({
      'readingHistory.readingDate': {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });
    
    // Calculate total consumption
    let totalMonthlyConsumption = 0;
    metersWithReadings.forEach(meter => {
      const currentMonthReadings = meter.readingHistory.filter(reading => {
        const readingDate = new Date(reading.readingDate);
        return readingDate >= startOfMonth && readingDate <= endOfMonth;
      });
      
      if (currentMonthReadings.length > 0) {
        totalMonthlyConsumption += currentMonthReadings.reduce((sum, reading) => sum + (reading.consumption || 0), 0);
      }
    });
    
    return reply.code(200).send({
      message: 'Monthly consumption retrieved successfully',
      data: {
        total: totalMonthlyConsumption
      }
    });
  } catch (err) {
    console.error('Error in retrieving monthly consumption:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getMonthlyConsumption;