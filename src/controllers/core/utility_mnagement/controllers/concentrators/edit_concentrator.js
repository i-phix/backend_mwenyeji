const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const update_concentrator = async (request, reply) => {
    try {
      const { concentratorId } = request.params;
      const updateData = request.body;
  
      // Validate location data if it's being updated
      if (updateData.location) {
        const { city, latitude, longitude } = updateData.location;
        
        // Validate latitude
        if (latitude && (latitude < -90 || latitude > 90)) {
          return reply.code(400).send({ 
            error: 'Latitude must be between -90 and 90 degrees' 
          });
        }
        
        // Validate longitude
        if (longitude && (longitude < -180 || longitude > 180)) {
          return reply.code(400).send({ 
            error: 'Longitude must be between -180 and 180 degrees' 
          });
        }
      }
  
      const updatedConcentrator = await payservedb.Concentrator.findByIdAndUpdate(
        concentratorId,
        updateData,
        { new: true, runValidators: true }
      );
  
      if (!updatedConcentrator) {
        return reply.code(404).send({ error: 'Concentrator not found' });
      }
  
      return reply.code(200).send(updatedConcentrator);
    } catch (err) {
      logger.error('Error updating concentrator:', err);
      return reply.code(502).send({ error: err.message });
    }
  };

module.exports = update_concentrator;