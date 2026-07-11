const axios = require('axios');
require('dotenv').config();

const getAllMeterProtocols = async (request, reply) => {
    try {
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        const response = await axios.get(`${powerMeterServiceUrl}/get_all_protocols`);

        return reply.code(200).send({
            message: 'Meter protocols fetched successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error fetching meter protocols:', error);

        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to fetch meter protocols'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getAllMeterProtocols;
