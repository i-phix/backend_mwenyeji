const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getAnalogMeterDetails = async (request, reply) => {
  try {
    const { facilityId, meterId } = request.params;
    
    if (!facilityId || !meterId) {
      return reply.code(400).send({
        success: false,
        error: 'facilityId and meterId are required'
      });
    }
    const MeterModel = await utilityDb.getModel('WaterMeter');
    
    const meter = await MeterModel.findOne({ 
      _id: meterId,
      facilityId,
      meterType: 'analog' 
    });
    
    if (!meter) {
      return reply.code(404).send({
        success: false,
        error: 'Analog meter not found'
      });
    }

    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const customerModel = await getModel('Customer', payservedb.Customer.schema);

    let customer = null;
    let unit = null;
    
    if (meter.customerId) {
      try {
        customer = await customerModel.findById(meter.customerId);
      } catch (err) {
        
      }
    }
    
    if (meter.unitId) {
      try {
        unit = await unitModel.findById(meter.unitId);
      } catch (err) {
        
      }
    }

    const meterWithInfo = {
      ...meter.toObject(),
      CustomerInfo: customer
        ? {
            _id: customer._id,
            fullName: `${customer.firstName} ${customer.lastName}`,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phoneNumber: customer.phoneNumber
          }
        : null,
      UnitInfo: unit
        ? {
            _id: unit._id,
            name: unit.name,
            unitNumber: unit.unitNumber
          }
        : null,
    };

    return reply.code(200).send({
      success: true,
      message: 'Analog meter details retrieved successfully',
      meter: meterWithInfo,
    });
  } catch (err) {
    console.error('Error in retrieving analog meter details:', err);
    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getAnalogMeterDetails;