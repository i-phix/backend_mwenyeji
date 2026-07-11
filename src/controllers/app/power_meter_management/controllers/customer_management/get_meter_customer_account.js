const axios = require('axios');
require('dotenv').config();

const getMeterCustomerAccounts = async (request, reply) => {
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
        const response = await axios.get(`${powerMeterServiceUrl}/meter_customer_accounts/${meterId}`);

        return reply.code(200).send({
            message: 'Meter customer accounts retrieved successfully',
            data: response.data.data || response.data,
            count: response.data.count || (response.data.data ? response.data.data.length : 0)
        });

    } catch (error) {
        console.error('Error forwarding get meter customer accounts request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get meter customer accounts'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getMeterCustomerAccounts;