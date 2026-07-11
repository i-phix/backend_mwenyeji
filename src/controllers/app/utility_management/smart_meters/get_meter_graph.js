const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get monthly water consumption for all meters in a facility
 * Returns formatted data for graph display
 */
const get_monthly_usage = async (request, reply) => {
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
    
    // Get all water meters for the facility regardless of type
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const meters = await WaterMeterModel.find({
      facilityId
    });
    
    if (!meters || meters.length === 0) {
      return reply.code(200).send({
        message: 'No meters found for this facility',
        usageData: {
          labels: [],
          data: []
        }
      });
    }
    
    const MonthlyWaterMeterHistory = await utilityDb.getModel('MonthlyWaterMeterHistory');
  
    // Get meter IDs and ensure consistent ObjectId handling
    const meterIds = meters.map(meter => meter._id);
    const monthlyHistories = await MonthlyWaterMeterHistory.find({
      meterId: { $in: meterIds },
      yearMonth: yearMonth
    });
    
    // Create a map for quick lookup of meter numbers by meter ID
    const meterNumberMap = {};
    meters.forEach(meter => {
      meterNumberMap[meter._id.toString()] = meter.meterNumber;
    });
    
    // Process data for graph format
    const usageData = monthlyHistories.map(history => {
      const meterNumber = meterNumberMap[history.meterId.toString()] || 'Unknown';
      return {
        meter_sn: meterNumber,
        usage: history.consumption
      };
    });
    
    // Format data as required for the graph
    const labels = usageData.map(item => item.meter_sn);
    const data = usageData.map(item => item.usage);
    
    return reply.code(200).send({
      message: 'Monthly usage data retrieved successfully',
      yearMonth: yearMonth,
      usageData: {
        raw: usageData,
        labels: labels,
        data: data
      }
    });
  } catch (err) {
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

module.exports = get_monthly_usage;