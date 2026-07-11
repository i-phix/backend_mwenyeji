const axios = require('axios');
require('dotenv').config();

const addMeterProtocol = async (request, reply) => {
    try {
        const { name } = request.body;

        if (!name) {
            return reply.code(400).send({
                error: 'Protocol name is required'
            });
        }

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        const response = await axios.post(`${powerMeterServiceUrl}/add_protocol`, { name });

        return reply.code(200).send({
            message: 'Meter protocol added successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding add meter protocol request:', error);

        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to add meter protocol'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = addMeterProtocol;
