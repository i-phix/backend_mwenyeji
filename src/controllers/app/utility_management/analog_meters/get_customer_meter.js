const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getCustomerMeters = async (request, reply) => {
  try {
    const { facilityId, customerId } = request.params;

    if (!facilityId || !customerId) {
      return reply.code(400).send({
        success: false,
        error: 'facilityId and customerId are required'
      });
    }

    // Get the meter model from utility database
    const MeterModel = await utilityDb.getModel('WaterMeter');
    
    // Get unit model from payserve database
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // Find all meters associated with the customer ID
    const meters = await MeterModel.find({ 
      customerId,
      facilityId 
    });

    if (!meters || meters.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'No meters found for this customer'
      });
    }

    // Retrieve the customer information from payserve database
    const customer = await payservedb.Customer.findById(customerId);
    if (!customer) {
      return reply.code(404).send({
        success: false,
        error: 'Customer not found'
      });
    }

    // Create customer info object
    const customerInfo = {
      _id: customer._id,
      fullName: `${customer.firstName} ${customer.lastName}`,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phoneNumber
    };

    // Process each meter to include unit information
    const metersWithInfo = await Promise.all(meters.map(async (meter) => {
      let unitInfo = null;

      if (meter.unitId) {
        try {
          const unit = await unitModel.findById(meter.unitId);
          if (unit) {
            unitInfo = {
              _id: unit._id,
              name: unit.name,
              unitNumber: unit.unitNumber
            };
          }
        } catch (err) {
          // Unit lookup failed, unitInfo remains null
        }
      }

      return {
        ...meter.toObject(),
        UnitInfo: unitInfo,
        CustomerInfo: customerInfo
      };
    }));

    return reply.code(200).send({
      success: true,
      message: 'Customer meters retrieved successfully',
      customer: customerInfo,
      meters: metersWithInfo,
      count: metersWithInfo.length
    });
  } catch (err) {
    console.error('Error in retrieving customer meters:', err);
    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getCustomerMeters;