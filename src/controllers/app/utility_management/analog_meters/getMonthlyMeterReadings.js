const utilityDb = require('../../../../middlewares/utilityDb');

const getMonthlyMeterConsumption = async (request, reply) => {
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

        // Get monthly consumption data
        // Assuming you have a model that stores the monthly data you showed
        const MonthlyWaterMeterHistoryModel = await utilityDb.getModel('MonthlyWaterMeterHistory');
        
        const monthlyConsumption = await MonthlyWaterMeterHistoryModel
            .find({ meterId: meterId })
            .sort({ yearMonth: -1 }) // Most recent first
            .lean();

        return reply.code(200).send({
            message: 'Monthly meter consumption retrieved successfully',
            data: monthlyConsumption
        });

    } catch (err) {
        console.error('Error retrieving monthly meter consumption:', err);
        return reply.code(500).send({
            error: 'Internal server error while retrieving monthly consumption'
        });
    }
};

module.exports = getMonthlyMeterConsumption;