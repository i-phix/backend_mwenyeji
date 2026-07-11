const utilityDb = require('../../../../middlewares/utilityDb');

/**
 * Get monthly water consumption for bulk meters in a facility,
 * grouped by bulkMeterDescription
 */
const get_bulk_monthly_usage_grouped = async (request, reply) => {
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
    const yearMonth = year && month
      ? `${year}-${String(month).padStart(2, '0')}`
      : getCurrentYearMonth();
    
    // Fetch only bulk water meters for the facility
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const bulkMeters = await WaterMeterModel.find({
      facilityId,
      bulkMeter: true
    });
    
    if (!bulkMeters || bulkMeters.length === 0) {
      return reply.code(200).send({
        message: 'No bulk meters found for this facility',
        usageData: {
          labels: [],
          data: []
        }
      });
    }
    
    const MonthlyWaterMeterHistory = await utilityDb.getModel('MonthlyWaterMeterHistory');
  
    // Map: meterId -> description
    const meterDescriptionMap = {};
    bulkMeters.forEach(meter => {
      meterDescriptionMap[meter._id.toString()] = meter.bulkMeterDescription || 'Unknown';
    });

    // Get monthly histories for these meters
    const meterIds = bulkMeters.map(meter => meter._id);
    const monthlyHistories = await MonthlyWaterMeterHistory.find({
      meterId: { $in: meterIds },
      yearMonth: yearMonth
    });

    // Group by description
    const groupedUsage = {};
    monthlyHistories.forEach(history => {
      const desc = meterDescriptionMap[history.meterId.toString()] || 'Unknown';
      if (!groupedUsage[desc]) {
        groupedUsage[desc] = 0;
      }
      groupedUsage[desc] += history.consumption || 0;
    });

    // Convert grouped data to array format for graph
    const labels = Object.keys(groupedUsage);
    const data = Object.values(groupedUsage);

    return reply.code(200).send({
      message: 'Bulk meters monthly usage grouped by description retrieved successfully',
      yearMonth: yearMonth,
      usageData: {
        raw: groupedUsage, // object form {desc: total}
        labels: labels,    // array for graph
        data: data         // array for graph
      }
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

// Helper
function getCurrentYearMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

module.exports = get_bulk_monthly_usage_grouped;
