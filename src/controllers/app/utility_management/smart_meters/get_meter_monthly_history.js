const { ObjectId } = require('mongoose').Types;
const utilityDb = require('../../../../middlewares/utilityDb');

/**
 * Get complete monthly history for a specific meter
 * Returns all monthly consumption records for the meter
 */
const get_meter_monthly_history = async (request, reply) => {
  try {
    const { meterId } = request.params;
    const { limit, sort } = request.query;
    
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
    
    // Prepare query options
    const queryOptions = {};
    
    // Apply limit if provided
    if (limit && !isNaN(parseInt(limit))) {
      queryOptions.limit = parseInt(limit);
    }
    
    // Apply sort (default to newest first)
    const sortDirection = (sort === 'asc') ? 1 : -1;
    queryOptions.sort = { yearMonth: sortDirection };

    // Get data from utilityDb
    const MonthlyWaterMeterHistory = await utilityDb.getModel('MonthlyWaterMeterHistory');
    
    const query = { meterId: new ObjectId(meterId) };
    const monthlyRecords = await MonthlyWaterMeterHistory
      .find(query, null, queryOptions)
      .select('yearMonth initialReading finalReading consumption createdAt updatedAt');
    
    // Format the response data
    const historyData = monthlyRecords.map(record => {
      return {
        yearMonth: record.yearMonth,
        initialReading: record.initialReading,
        finalReading: record.finalReading,
        consumption: record.consumption,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });
    
    // Get total consumption across all months
    const totalConsumption = historyData.reduce((sum, record) => sum + record.consumption, 0);
    
    return reply.code(200).send({
      success: true,
      message: 'Meter monthly history retrieved successfully',
      meterId: meterId,
      totalConsumption: totalConsumption,
      recordCount: historyData.length,
      history: historyData
    });
  } catch (err) {
    console.error('Error in get_meter_monthly_history:', err);
    return reply.code(502).send({ 
      success: false, 
      error: err.message 
    });
  }
};

module.exports = get_meter_monthly_history;