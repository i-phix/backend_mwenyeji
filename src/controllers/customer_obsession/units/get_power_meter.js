const axios = require('axios');
const logger = require('../../../../config/winston');
require('dotenv').config();

const getPowerMeterByUnit = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const userType = request.user.type;
        const { unitId } = request.params;

        // Verify user is customer support agent
        if (userType !== 'Customer_Support') {
            return reply.code(403).send({
                success: false,
                error: 'Access denied. Customer Support agents only.'
            });
        }

        if (!unitId) {
            return reply.code(400).send({
                success: false,
                error: 'Unit ID is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;

        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                success: false,
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.get(`${powerMeterServiceUrl}/get_unit_meter/${unitId}`);

        logger.info(`Agent ${userId} retrieved power meter for unit ${unitId}`);

        return reply.code(200).send({
            success: true,
            data: response.data.data || response.data
        });

    } catch (error) {
        logger.error(`Error fetching power meter: ${error.message}`);

        // Handle axios errors
        if (error.response) {
            if (error.response.status === 404) {
                return reply.code(404).send({
                    success: false,
                    error: 'No power meter found for this unit',
                    data: null
                });
            }

            return reply.code(error.response.status).send({
                success: false,
                error: error.response.data.error || 'Failed to get power meter details'
            });
        }

        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve power meter details'
        });
    }
};

module.exports = getPowerMeterByUnit;
