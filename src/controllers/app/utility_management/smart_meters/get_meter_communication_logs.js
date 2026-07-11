const { ObjectId } = require('mongoose').Types;
const utilityDb = require('../../../../middlewares/utilityDb');

const get_meter_logs = async (request, reply) => {
  try {
    const { meterId } = request.params;
    const { sort, limit, page } = request.query;

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
    const MeterLogModel = await utilityDb.getModel('MeterLog');

    // Prepare query object - filter by meterId
    const query = { meterId: new ObjectId(meterId) };

    // Apply sort (default to newest first)
    const sortDirection = (sort === 'asc') ? 1 : -1;
    
    // Set up pagination
    const pageSize = limit ? parseInt(limit) : 20;
    const currentPage = page ? parseInt(page) : 1;
    const skip = (currentPage - 1) * pageSize;

    // Get count of total logs for this meter
    const totalLogs = await MeterLogModel.countDocuments(query);
    
    // Get logs with pagination
    const logs = await MeterLogModel
      .find(query)
      .sort({ timestamp: sortDirection })
      .skip(skip)
      .limit(pageSize);

    // Format the response data
    const formattedLogs = logs.map(log => {
      return {
        id: log._id,
        command: log.command,
        platform: log.platform,
        reason: log.reason,
        actionBy: log.actionBy,
        timestamp: log.timestamp
      };
    });

    return reply.code(200).send({
      success: true,
      message: 'Meter logs retrieved successfully',
      meterId: meterId,
      pagination: {
        total: totalLogs,
        page: currentPage,
        pageSize: pageSize,
        pages: Math.ceil(totalLogs / pageSize)
      },
      logs: formattedLogs
    });
  } catch (err) {
    console.error('Error in get_meter_logs:', err);
    return reply.code(502).send({ 
      success: false, 
      error: err.message 
    });
  }
};

module.exports = get_meter_logs;