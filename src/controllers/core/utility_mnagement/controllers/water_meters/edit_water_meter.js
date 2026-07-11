const utilityDb = require('../../../../../middlewares/utilityDb'); 

const update_meter = async (request, reply) => {
    try {
        // Get the model
        const MeterModel = await utilityDb.getModel('WaterMeter');
        
        // Get meterId from request parameters and update data from the body
        const { meterId } = request.params;
        const updateData = request.body;
        
        // Perform the update operation with the new data
        const updatedMeter = await MeterModel.findByIdAndUpdate(
            meterId,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!updatedMeter) {
            return reply.code(404).send({ error: 'Water meter not found' });
        }
        
        return reply.code(200).send(updatedMeter);
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_meter;