const axios = require('axios');
require('dotenv').config();

const deleteMeterProtocol = async (request, reply) => {
    try {
        const { id } = request.params;

        if (!id) {
            return reply.code(400).send({
                error: 'Protocol ID is required'
            });
        }

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        const response = await axios.delete(`${powerMeterServiceUrl}/delete_protocol/${id}`);

        return reply.code(200).send({
            message: 'Meter protocol deleted successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error deleting meter protocol:', error);

        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to delete meter protocol'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = deleteMeterProtocol;
