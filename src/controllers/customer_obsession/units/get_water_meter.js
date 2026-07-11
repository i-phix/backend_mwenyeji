const utilityDb = require('../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');

const getWaterMeterByUnit = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const userType = request.user.type;
        const { facilityId, unitId } = request.params;

        // Verify user is customer support agent
        if (userType !== 'Customer_Support') {
            return reply.code(403).send({
                success: false,
                error: 'Access denied. Customer Support agents only.'
            });
        }

        if (!facilityId || !unitId) {
            return reply.code(400).send({
                success: false,
                error: 'facilityId and unitId are required'
            });
        }

        // Get models - meter from utility DB, unit from payserve DB
        const MeterModel = await utilityDb.getModel('WaterMeter');
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // Find the unit first
        const unit = await UnitModel.findById(unitId);
        if (!unit) {
            return reply.code(404).send({
                success: false,
                error: 'Unit not found'
            });
        }

        // Find the meter associated with this unit from utility database
        const meter = await MeterModel.findOne({
            unitId: unitId,
            facilityId: facilityId
        });

        if (!meter) {
            return reply.code(404).send({
                success: false,
                error: 'No meter found for this unit',
                data: null
            });
        }

        // Create a simplified meter object
        const meterInfo = {
            _id: meter._id,
            status: meter.status,
            meterNumber: meter.meterNumber,
            meterType: meter.meterType,
            currentReading: meter.currentReading,
            previousReading: meter.previousReading,
            lastReadingDate: meter.lastReadingDate,
            lastUpdated: meter.updatedAt,
            facilityId: meter.facilityId,
            unitId: meter.unitId
        };

        logger.info(`Agent ${userId} retrieved water meter for unit ${unitId}`);

        return reply.code(200).send({
            success: true,
            message: 'Meter details retrieved successfully',
            meter: meterInfo
        });

    } catch (err) {
        logger.error(`Error fetching water meter: ${err.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve water meter details'
        });
    }
};

module.exports = getWaterMeterByUnit;
