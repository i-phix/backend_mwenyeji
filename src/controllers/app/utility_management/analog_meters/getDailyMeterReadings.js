const utilityDb = require('../../../../middlewares/utilityDb');

const getDailyMeterReadings = async (request, reply) => {
    try {
        const { meterId } = request.params;

        if (!meterId) {
            return reply.code(400).send({
                error: 'meterId is required'
            });
        }

        // Verify meter exists
        const MeterModel = await utilityDb.getModel('WaterMeter');
        const meter = await MeterModel.findById(meterId);
        if (!meter) {
            return reply.code(404).send({
                error: 'Meter not found'
            });
        }

        // Get daily readings
        const DailyWaterMeterHistoryModel = await utilityDb.getModel('DailyWaterMeterHistory');
        
        const dailyReadings = await DailyWaterMeterHistoryModel
            .find({ meterId: meterId })
            .sort({ date: -1 }) // Most recent first
            .lean();

        return reply.code(200).send({
            message: 'Daily meter readings retrieved successfully',
            data: dailyReadings
        });

    } catch (err) {
        console.error('Error retrieving daily meter readings:', err);
        return reply.code(500).send({ 
            error: 'Internal server error while retrieving daily readings' 
        });
    }
};

module.exports = getDailyMeterReadings;