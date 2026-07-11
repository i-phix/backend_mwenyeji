const axios = require('axios');
require('dotenv').config();

const getMeterMonthlyConsumption = async (request, reply) => {
    try {
        const { meterId } = request.params;

        // Basic validation
        if (!meterId) {
            return reply.code(400).send({
                error: 'Meter ID is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.get(`${powerMeterServiceUrl}/meter_monthly_consumption/${meterId}`);

        return reply.code(200).send({
            message: 'Monthly consumption retrieved successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding monthly consumption request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get monthly consumption'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getMeterMonthlyConsumption;