const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const getDeliveryDetails = async (request, reply) => {
  try {
    const deliveryModel = await getModel('MetersDelivery', payservedb.MetersDelivery.schema);
    const deliveryId = request.params.deliveryId;

    // Find the delivery document
    const delivery = await deliveryModel.findById(deliveryId);
    if (!delivery) {
      return reply.code(404).send({ error: 'Delivery not found' });
    }

    // Enrich meter details (including unit information)
    const enrichedMeters = await Promise.all(
      (delivery.meters || []).map(async (meter) => {
        let meterDetails = null;
        if (meter.meterId) {
          meterDetails = await payservedb.Meter.findById(meter.meterId);
          if (meterDetails && meterDetails.unitId) {
            // Fetch unit details and attach as UnitInfo
            const unit = await payservedb.Unit.findById(meterDetails.unitId);
            meterDetails = meterDetails.toObject();
            meterDetails.UnitInfo = unit ? { _id: unit._id, name: unit.name } : null;
          }
        }
        return {
          ...meter.toObject(),
          meterDetails,
        };
      })
    );

    // Enrich concentrator details
    const enrichedConcentrators = await Promise.all(
      (delivery.concentrators || []).map(async (conc) => {
        let concentratorDetails = null;
        if (conc.concentratorId) {
          concentratorDetails = await payservedb.Concentrator.findById(conc.concentratorId);
          if (concentratorDetails) {
            concentratorDetails = concentratorDetails.toObject();
          }
        }
        return {
          ...conc.toObject(),
          concentratorDetails,
        };
      })
    );

    // Build a unique list of unit IDs from the enriched meters
    const unitIdsSet = new Set();
    enrichedMeters.forEach((meter) => {
      if (meter.meterDetails && meter.meterDetails.UnitInfo) {
        unitIdsSet.add(meter.meterDetails.UnitInfo._id.toString());
      }
    });
    const unitIds = Array.from(unitIdsSet);

    // Enrich unit details based on the collected unit IDs
    const enrichedUnits = await Promise.all(
      unitIds.map(async (unitId) => {
        const unit = await payservedb.Unit.findById(unitId);
        return unit ? unit.toObject() : null;
      })
    );

    // Convert delivery to a plain object and attach the enriched arrays
    const enrichedDelivery = delivery.toObject();
    enrichedDelivery.meters = enrichedMeters;
    enrichedDelivery.concentrators = enrichedConcentrators;
    enrichedDelivery.units = enrichedUnits.filter(u => u !== null);

    return reply.code(200).send({
      message: 'Delivery retrieved successfully',
      delivery: enrichedDelivery,
    });
  } catch (err) {
    logger.error(`Error retrieving delivery details: ${err.message}`);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = getDeliveryDetails;
