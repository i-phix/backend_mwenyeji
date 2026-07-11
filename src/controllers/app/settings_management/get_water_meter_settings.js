const utilityDb = require('../../../middlewares/utilityDb');
const payservedb = require('payservedb');

const get_water_meter_settings = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required'
      });
    }

    // Verify facility exists in payservedb
    const facility = await payservedb.Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({
        success: false,
        error: 'Facility not found'
      });
    }

    // Get the WaterMeterSettings model from the utility DB
    const WaterMeterSettingsModel = await utilityDb.getModel('WaterMeterSettings');

    // Find settings for this facility in the utility database
    const settings = await WaterMeterSettingsModel.findOne({ facilityId }).lean();
        
    if (!settings) {
      // Return 200 with a clear message instead of 404 error
      return reply.code(200).send({
        success: true,
        data: null,
        message: 'No meter settings configured for this facility yet'
      });
    }

    return reply.code(200).send({
      success: true,
      data: settings
    });
  } catch (err) {
    console.error('Error in get_water_meter_settings:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = get_water_meter_settings;