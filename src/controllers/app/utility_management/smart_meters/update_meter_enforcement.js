const utilityDb = require('../../../../middlewares/utilityDb');

const updateMeterEnforcement = async (request, reply) => {
  try {
    // Get the meterId and enforcement status from request params and body
    const { meterId } = request.params;
    const { enforcement } = request.body;
    
    if (!meterId) {
      return reply.code(400).send({
        error: 'meterId is required as a parameter'
      });
    }
    
    if (enforcement === undefined) {
      return reply.code(400).send({
        error: 'enforcement status is required in the request body'
      });
    }
    
    // Get the meter model from utilityDb
    const MeterModel = await utilityDb.getModel('WaterMeter');
    
    // Find and update the meter by meterId instead of unitId
    const updatedMeter = await MeterModel.findOneAndUpdate(
      { _id: meterId }, // Use meterId to find the meter
      { enforcement: enforcement },
      { new: true } // Return the updated document
    );
    
    if (!updatedMeter) {
      return reply.code(404).send({
        error: 'No meter found with this ID'
      });
    }
    
    return reply.code(200).send({
      message: 'Meter enforcement status updated successfully',
      meter: updatedMeter
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = updateMeterEnforcement;