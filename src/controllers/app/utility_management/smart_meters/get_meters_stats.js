const utilityDb = require('../../../../middlewares/utilityDb');

const getMetersStats = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    
    if (!facilityId) {
      return reply.code(400).send({
        error: 'facilityId is required'
      });
    }

    const MeterModel = await utilityDb.getModel('WaterMeter');
    
    // Get total installed meters only
    const totalMeters = await MeterModel.countDocuments({
      facilityId,
      installationStatus: 'installed'
    });
    
    // Get total opened meters
    const openMeters = await MeterModel.countDocuments({
      facilityId,
      status: 'opened'
    });
    
    // Get total closed meters
    const closedMeters = await MeterModel.countDocuments({
      facilityId,
      installationStatus: 'installed',
      status: 'closed'
    });
    
    return reply.code(200).send({
      message: 'Meter statistics retrieved successfully',
      stats: {
        totalMeters,
        openMeters,
        closedMeters
      }
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = getMetersStats;