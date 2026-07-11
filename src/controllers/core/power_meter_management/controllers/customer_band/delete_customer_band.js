const axios = require('axios');
require('dotenv').config();

const deleteCustomerBand = async (request, reply) => {
    try {
        const { bandId } = request.params;

        if (!bandId) {
            return reply.code(400).send({
                error: 'Customer Band ID is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;

        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward delete request to Power Meter Service
        const response = await axios.delete(`${powerMeterServiceUrl}/delete_customer_band/${bandId}`);

        return reply.code(200).send({
            message: 'Customer band deleted successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding delete customer band request:', error);

        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to delete customer band'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = deleteCustomerBand;
