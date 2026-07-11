const utilityDb = require('../../../../middlewares/utilityDb');

const update_meter = async (request, reply) => {
    try {
        const { meterId } = request.params;
        const { meterValueType, meterValue, ...otherData } = request.body;

        // Get the WaterMeter model from utility database
        const MeterModel = await utilityDb.getModel('WaterMeter');

        const updateData = { ...otherData };

        // Update the correct reading based on meterValueType
        if (meterValueType === 'initial') {
            updateData.initialReading = meterValue;
        } else if (meterValueType === 'current') {
            updateData.currentReading = meterValue;
        }

        // Update the meter using the utility database model
        const updatedMeter = await MeterModel.findByIdAndUpdate(
            meterId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedMeter) {
            return reply.code(404).send({ 
                success: false,
                error: 'Water meter not found' 
            });
        }

        // Return just the updated meter data
        return reply.code(200).send({
            success: true,
            data: updatedMeter
        });
    } catch (err) {
        return reply.code(502).send({ 
            success: false,
            error: err.message 
        });
    }
};

module.exports = update_meter;