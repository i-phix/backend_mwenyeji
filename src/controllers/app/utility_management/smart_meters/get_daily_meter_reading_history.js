const { ObjectId } = require('mongoose').Types;
const utilityDb = require('../../../../middlewares/utilityDb');

/**
 * Get all daily history for a specific meter
 * Returns readings and dates for client-side filtering
 */
const get_meter_daily_history = async (request, reply) => {
  try {
    const { meterId } = request.params;
    const { sort } = request.query;

    // Validate meterId
    if (!meterId) {
      return reply.code(400).send({ 
        success: false,
        error: 'meterId is required' 
      });
    }

    // Verify meterId format
    if (!meterId.match(/^[0-9a-fA-F]{24}$/)) {
      return reply.code(400).send({ 
        success: false,
        error: 'Invalid meter ID format' 
      });
    }

    // Get the model from utilityDb
    const DailyWaterMeterHistory = await utilityDb.getModel('DailyWaterMeterHistory');

    // Prepare query object - only filter by meterId
    const query = { meterId: new ObjectId(meterId) };

    // Apply sort (default to newest first)
    const sortDirection = (sort === 'asc') ? 1 : -1;
    const queryOptions = { sort: { date: sortDirection } };

    // Get all daily records for this meter
    const dailyRecords = await DailyWaterMeterHistory
      .find(query, null, queryOptions)
      .select('date reading status createdAt');

    // Format the response data with formatted dates
    const historyData = dailyRecords.map(record => {
      const recordDate = new Date(record.date);
      const formattedDate = formatDate(recordDate);

      return {
        date: formattedDate,
        reading: record.reading,
        status: record.status,
        timestamp: record.createdAt
      };
    });

    return reply.code(200).send({
      success: true,
      message: 'Meter daily history retrieved successfully',
      meterId: meterId,
      recordCount: historyData.length,
      history: historyData
    });
  } catch (err) {
    console.error('Error in get_meter_daily_history:', err);
    return reply.code(502).send({ 
      success: false, 
      error: err.message 
    });
  }
};

// Function to format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

module.exports = get_meter_daily_history;