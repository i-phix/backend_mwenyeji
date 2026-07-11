const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_meters = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.code(400).send({ error: 'facilityId is required' });
    }

    const MeterModel = await utilityDb.getModel('WaterMeter');

    const meters = await MeterModel.find({
      facilityId,
      meterType: 'smart'
    });

    const unitModel     = await getModel('Unit',     payservedb.Unit.schema,     facilityId);
    const customerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);

    const metersWithInfo = await Promise.all(
      meters.map(async (meter) => {
        let customerInfo = null;
        let unitInfo     = null;

        // ── Customer info ──────────────────────────────────────────────────
        if (meter.customerId) {
          try {
            const customer = await customerModel.findById(meter.customerId);
            if (customer) {
              customerInfo = {
                fullName:    `${customer.firstName} ${customer.lastName}`,
                phoneNumber: customer.phoneNumber
              };
            }
          } catch (_) {}
        }

        // ── UnitInfo — driven by meterCategory ────────────────────────────
        const category = meter.meterCategory || (meter.bulkMeter ? 'bulk' : 'unit');

        if (category === 'unit' && meter.unitId) {
          try {
            const unit = await unitModel.findById(meter.unitId);
            if (unit) {
              unitInfo = { name: unit.name };
            }
          } catch (_) {}
        } else if (category === 'bulk') {
          // Show the bulk description as the "unit" label
          unitInfo = { name: meter.bulkMeterDescription || 'Bulk Meter' };
        } else if (category === 'floor') {
          // Show the floor description as the "unit" label
          unitInfo = { name: meter.floorDescription || 'Floor Meter' };
        }

        return {
          ...meter.toObject(),
          CustomerInfo: customerInfo,
          UnitInfo:     unitInfo,
          // Expose resolved category so the frontend can use it
          resolvedCategory: category
        };
      })
    );

    return reply.code(200).send({
      message: 'Smart meters retrieved successfully',
      meters:  metersWithInfo
    });

  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_meters;