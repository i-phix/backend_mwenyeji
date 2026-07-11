const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_meter = async (request, reply) => {
  try {
    const { meterId } = request.params;
    
    if (!meterId) {
      return reply.code(400).send({
        error: 'meterId is required'
      });
    }
    
    const MeterModel = await utilityDb.getModel('WaterMeter');
    
    const meter = await MeterModel.findById(meterId);
    
    if (!meter) {
      return reply.code(404).send({ error: 'Water meter not found' });
    }
    
    // Use the facilityId from the meter itself
    const facilityId = meter.facilityId;
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const customerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
    
    let customerInfo = null;
    let unitInfo = null;
    
    if (meter.customerId) {
      try {
        const customer = await customerModel.findById(meter.customerId);
        if (customer) {
          customerInfo = {
            fullName: `${customer.firstName} ${customer.lastName}`,
            phoneNumber: customer.phoneNumber
          };
        }
      } catch (err) {
        // Handle customer lookup error silently
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
        // Handle unit lookup error silently
      }
    }
    
    return reply.code(200).send({
      message: 'Meter retrieved successfully',
      meter: {
        ...meter.toObject(),
        CustomerInfo: customerInfo,
        UnitInfo: unitInfo
      }
    });
    
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_meter;