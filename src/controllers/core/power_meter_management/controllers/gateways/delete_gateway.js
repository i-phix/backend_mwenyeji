const axios = require('axios');
require('dotenv').config();

const deletePowerMeterGateway = async (request, reply) => {
    try {
        const { id } = request.params;

        // Basic validation
        if (!id) {
            return reply.code(400).send({
                error: 'Gateway ID is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;

        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.delete(`${powerMeterServiceUrl}/delete_gateway/${id}`);

        return reply.code(200).send({
            message: 'Power meter gateway deleted successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding delete power meter gateway request:', error);

        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to delete power meter gateway'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = deletePowerMeterGateway;