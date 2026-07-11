const utilityDb = require('../../../../middlewares/utilityDb');

/**
 * Get total monthly water consumption for all meters in a facility
 * Simplified to return only yearMonth and totalConsumption
 */
const get_total_monthly_consumption = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { month, year } = request.query;
    
    // Validate facilityId
    if (!facilityId) {
      return reply.code(400).send({
        error: 'facilityId is required'
      });
    }
    
    // Get current year-month if not provided
    const yearMonth = year && month ?
      `${year}-${String(month).padStart(2, '0')}` :
      getCurrentYearMonth();
    
    // Get all water meters for the facility
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const meters = await WaterMeterModel.find({ facilityId });
    
    if (!meters || meters.length === 0) {
      return reply.code(200).send({
        yearMonth: yearMonth,
        totalConsumption: 0
      });
    }
    
    // Get meter IDs
    const meterIds = meters.map(meter => meter._id);
    
    const MonthlyWaterMeterHistory = await utilityDb.getModel('MonthlyWaterMeterHistory');
    
    const monthlyHistories = await MonthlyWaterMeterHistory.find({
      meterId: { $in: meterIds },
      yearMonth: yearMonth
    });
    
    // Calculate total consumption
    let totalConsumption = 0;
    monthlyHistories.forEach(history => {
      totalConsumption += history.consumption || 0;
    });
    
    return reply.code(200).send({
      yearMonth: yearMonth,
      totalConsumption: totalConsumption
    });
  } catch (err) {
    console.error('Error in get_total_monthly_consumption:', err);
    return reply.code(502).send({ error: err.message });
  }
};

// Function to get current year and month in YYYY-MM format
function getCurrentYearMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  
  return `${year}-${month}`;
}

module.exports = get_total_monthly_consumption;