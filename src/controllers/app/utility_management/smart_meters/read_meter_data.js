const axios = require('axios');
const utilityDb = require('../../../../middlewares/utilityDb');
require('dotenv').config();

const readMeter = async (request, reply) => {
  try {
    const { meterId } = request.params;
    const { reason, actionBy } = request.body;

    if (!meterId) {
      return reply.code(400).send({
        success: false,
        message: 'Meter ID is required'
      });
    }

    // Validate required fields from request body
    if (!reason || !actionBy) {
      return reply.code(400).send({
        success: false,
        message: 'Reason and actionBy are required'
      });
    }

    // Get the meter model and find the meter by ID
    const MeterModel = await utilityDb.getModel('WaterMeter');
    const meter = await MeterModel.findById(meterId);

    if (!meter) {
      return reply.code(404).send({
        success: false,
        message: 'Meter not found'
      });
    }

    const meterNumber = meter.meterNumber;
    const con = meter.concentratorSerialNumber;

    // Validate required fields
    if (!meterNumber || !con) {
      return reply.code(400).send({
        success: false,
        message: 'Meter number and concentrator number not available for this meter'
      });
    }

    // Get external service URL from environment variables
    const meterServiceUrl = process.env.sandboxReadMeterEndUrl;

    // Log the communication to MeterLog table before sending the request
    const MeterLogModel = await utilityDb.getModel('MeterLog');
    await MeterLogModel.create({
      meterId: meterId,
      command: 'get realtime data',
      platform: 'app',
      reason: reason,
      actionBy: actionBy.trim(),
      timestamp: new Date()
    });

    // Forward request to external Meter Service
    const response = await axios.post(meterServiceUrl, {
      meterNumber,
      con
    });

    return reply.code(200).send({
      success: true,
      message: 'The meter reading has been requested',
      data: response.data
    });
  } catch (error) {
    console.error('Error forwarding read meter request:', error);

    // Even if the request fails, we should still log the attempt
    try {
      const MeterLogModel = await utilityDb.getModel('MeterLog');
      const { reason, actionBy } = request.body;
      
      await MeterLogModel.create({
        meterId: request.params.meterId,
        command: 'get realtime data',
        platform: 'app',
        reason: reason || 'unknown',
        actionBy: actionBy ? actionBy.trim() : 'unknown',
        timestamp: new Date()
      });
    } catch (logError) {
      console.error('Failed to log meter communication:', logError);
    }

    return reply.code(502).send({
      success: false,
      message: 'Failed to communicate with meter service',
      error: error.message
    });
  }
};

module.exports = readMeter;