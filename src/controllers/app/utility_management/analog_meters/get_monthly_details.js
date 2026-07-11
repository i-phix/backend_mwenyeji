const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getMeterDetailsWithConsumption = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    
    // Get the facility-specific models
    const analogMeterModel = await getModel('WaterMeter', payservedb.WaterMeter.schema, facilityId);
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    
    // Get all meters
    const meters = await analogMeterModel.find();
    
    // Map through meters and add customer and unit information
    const metersWithInfo = await Promise.all(
      meters.map(async (meter) => {
        // Get customer information
        const customer = await payservedb.Customer.findById(meter.customerId);
        
        // Get unit information
        const unit = await unitModel.findById(meter.unitId);
        
        // Process reading history for consumption data
        const readingHistory = meter.readingHistory || [];
        
        // Calculate total consumption
        const totalConsumption = readingHistory.reduce((sum, reading) => sum + (reading.consumption || 0), 0);
        
        return {
          id: meter._id,
          serialNumber: meter.meterNumber,
          status: meter.status.toUpperCase(),
          lastReading: meter.currentReading,
          lastReadingDate: meter.lastReadingDate ? new Date(meter.lastReadingDate).toISOString().split('T')[0] : null,
          totalConsumption: totalConsumption,
          CustomerInfo: customer
            ? {
                _id: customer._id,
                fullName: customer.firstName && customer.lastName 
                  ? `${customer.firstName} ${customer.lastName}`
                  : customer.fullName || customer.name
              }
            : null,
          UnitInfo: unit
            ? {
                _id: unit._id,
                name: unit.name,
                unitNumber: unit.unitNumber
              }
            : null
        };
      })
    );
    
    return reply.code(200).send({
      message: 'Meter details retrieved successfully',
      meters: metersWithInfo
    });
  } catch (err) {
    console.error('Error in retrieving meter details:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getMeterDetailsWithConsumption;