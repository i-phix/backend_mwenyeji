const utilityDb = require('../../../../middlewares/utilityDb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get total daily water consumption for all meters in a facility
 * Simplified to return only date and totalConsumption
 */
const get_total_daily_consumption = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { date } = request.query;
    
    // Validate facilityId
    if (!facilityId) {
      return reply.code(400).send({
        error: 'facilityId is required'
      });
    }

    // Set target date (today by default)
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return reply.code(400).send({
          error: 'Invalid date format. Use YYYY-MM-DD'
        });
      }
    }
    
    // Set to midnight for consistent comparison
    targetDate.setHours(0, 0, 0, 0);
    
    // Calculate previous day
    const previousDate = new Date(targetDate);
    previousDate.setDate(previousDate.getDate() - 1);

    // Format date for display
    const formattedDate = formatDate(targetDate);
    
    // Get all water meters for the facility
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const meters = await WaterMeterModel.find({ facilityId });

    if (!meters || meters.length === 0) {
      return reply.code(200).send({
        date: formattedDate,
        totalConsumption: 0
      });
    }

    // Get meter IDs
    const meterIds = meters.map(meter => meter._id);
    
    const DailyWaterMeterHistory = await utilityDb.getModel('DailyWaterMeterHistory');
    
    const todayReadings = await DailyWaterMeterHistory.find({
      meterId: { $in: meterIds },
      date: targetDate
    });
    
    // Get previous day readings
    const yesterdayReadings = await DailyWaterMeterHistory.find({
      meterId: { $in: meterIds },
      date: previousDate
    });
    
    // Create lookup map for yesterday's readings
    const yesterdayReadingsMap = {};
    yesterdayReadings.forEach(record => {
      yesterdayReadingsMap[record.meterId.toString()] = record.reading;
    });

    // Create a map for quick lookup of meter numbers by meter ID
    const meterInfoMap = {};
    meters.forEach(meter => {
      meterInfoMap[meter._id.toString()] = {
        initialReading: meter.initialReading || 0
      };
    });
    
    // Calculate daily consumption for each meter
    let totalConsumption = 0;
    
    for (const todayRecord of todayReadings) {
      const meterId = todayRecord.meterId.toString();
      const yesterdayReading = yesterdayReadingsMap[meterId];
      const meterInfo = meterInfoMap[meterId] || { initialReading: 0 };
      
      // Calculate consumption
      let consumption = 0;
      
      if (yesterdayReading !== undefined) {
        // If we have yesterday's reading, calculate the difference
        consumption = todayRecord.reading - yesterdayReading;
      } else {
        // If no yesterday reading, use the meter's initial reading as a fallback
        consumption = todayRecord.reading - meterInfo.initialReading;
      }
      
      // Ensure consumption is not negative (could happen with meter resets)
      consumption = Math.max(0, consumption);
      
      totalConsumption += consumption;
    }

    return reply.code(200).send({
      date: formattedDate,
      totalConsumption: totalConsumption
    });
  } catch (err) {
    console.error('Error in get_total_daily_consumption:', err);
    return reply.code(502).send({ error: err.message });
  }
};

// Function to format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

module.exports = get_total_daily_consumption;