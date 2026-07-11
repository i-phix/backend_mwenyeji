const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getAnalogMeters = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    
    if (!facilityId) {
      return reply.code(400).send({
        error: 'facilityId is required'
      });
    }
    const MeterModel = await utilityDb.getModel('WaterMeter');

    const meters = await MeterModel.find({ 
      facilityId,
      meterType: 'analog' 
    });
    
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const customerModel = await getModel('Customer', payservedb.Customer.schema);
    
    const metersWithInfo = await Promise.all(
      meters.map(async (meter) => {
        let customerInfo = null;
        let unitInfo = null;
        
        if (meter.customerId) {
          try {
            const customer = await customerModel.findById(meter.customerId);
            if (customer) {
              customerInfo = {
                fullName: `${customer.firstName} ${customer.lastName}`
              };
            }
          } catch (err) {
          }
        }

        if (meter.unitId) {
          try {
            const unit = await unitModel.findById(meter.unitId);
            if (unit) {
              unitInfo = {
                name: unit.name
              };
            }
          } catch (err) {
            
          }
        }
        
        return {
          ...meter.toObject(),
          CustomerInfo: customerInfo,
          UnitInfo: unitInfo
        };
      })
    );
    
    return reply.code(200).send({
      message: 'Analog meters retrieved successfully',
      meters: metersWithInfo
    });
  } catch (err) {
    console.error('Error in retrieving analog meters:', err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = getAnalogMeters;