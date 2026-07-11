const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getMeterDetailsByUnit = async (request, reply) => {
  try {
    const { facilityId, unitId } = request.params;
    
    if (!facilityId || !unitId) {
      return reply.code(400).send({
        success: false,
        error: 'facilityId and unitId are required'
      });
    }

    // Get models - meter from utility DB, unit from payserve DB
    const MeterModel = await utilityDb.getModel('WaterMeter');
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    
    // Find the unit first
    const unit = await unitModel.findById(unitId);
    if (!unit) {
      return reply.code(404).send({
        success: false,
        error: 'Unit not found'
      });
    }
    
    // Find the meter associated with this unit from utility database
    const meter = await MeterModel.findOne({ 
      unitId: unitId,
      facilityId: facilityId
    });
    
    if (!meter) {
      return reply.code(404).send({
        success: false,
        error: 'No meter found for this unit'
      });
    }
    
    // Create a simplified meter object
    const meterInfo = {
      _id: meter._id,
      status: meter.status,
      meterNumber: meter.meterNumber,
      meterType: meter.meterType,
      currentReading: meter.currentReading,
      previousReading: meter.previousReading,
      lastReadingDate: meter.lastReadingDate,
      lastUpdated: meter.updatedAt,
      facilityId: meter.facilityId,
      unitId: meter.unitId
    };
    
    // Return with success structure
    return reply.code(200).send({
      success: true,
      message: 'Meter details retrieved successfully',
      meter: meterInfo
    });
  } catch (err) {
    console.error('Error in retrieving meter details by unit:', err);
    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getMeterDetailsByUnit;