const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getAnalogMeterCounts = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    
    const analogMeterModel = await getModel('WaterMeter', payservedb.WaterMeter.schema, facilityId);
    
    const openCount = await analogMeterModel.countDocuments({ status: 'opened' });
    const closedCount = await analogMeterModel.countDocuments({ status: 'closed' });
    const maintenanceCount = await analogMeterModel.countDocuments({ status: 'maintenance' });
    const faultyCount = await analogMeterModel.countDocuments({ status: 'faulty' });
    
    const totalCount = await analogMeterModel.countDocuments();
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    const metersWithReadings = await analogMeterModel.find({
      'readingHistory.readingDate': {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });
    
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
      message: 'Analog meter counts retrieved successfully',
      data: {
        opened: openCount,
        closed: closedCount,
        maintenance: maintenanceCount,
        faulty: faultyCount,
        total: totalCount
        // monthlyConsumption: totalMonthlyConsumption
      }
    });
  } catch (err) {
    console.error('Error in retrieving analog meter counts:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getAnalogMeterCounts;