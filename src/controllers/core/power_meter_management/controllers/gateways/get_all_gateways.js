const axios = require('axios');
require('dotenv').config();

const getAllPowerMeterGateways = async (request, reply) => {
    try {
        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;

        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.get(`${powerMeterServiceUrl}/get_all_gateways`);

        return reply.code(200).send({
            message: 'Power meter gateways fetched successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding fetch all power meter gateways request:', error);

        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to fetch power meter gateways'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getAllPowerMeterGateways;