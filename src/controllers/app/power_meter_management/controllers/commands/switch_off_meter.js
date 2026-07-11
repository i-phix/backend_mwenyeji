const axios = require('axios');
require('dotenv').config();

const switchPowerMeterOff = async (request, reply) => {
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
        const response = await axios.post(`${powerMeterServiceUrl}/switch_off_meter/${meterId}`, {
            platform: 'app'
        });

        return reply.code(200).send({
            message: 'Power meter switched off successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding switch off power meter request:', error);
                
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to switch off power meter'
            });
        }
                
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = switchPowerMeterOff;