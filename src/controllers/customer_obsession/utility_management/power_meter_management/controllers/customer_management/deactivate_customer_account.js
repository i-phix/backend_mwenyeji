const axios = require('axios');
require('dotenv').config();

const deactivateCustomerAccount = async (request, reply) => {
    try {
        const { accountId } = request.params;

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.put(`${powerMeterServiceUrl}/deactivate_customer_account/${accountId}`);

        return reply.code(200).send({
            message: 'Customer account deactivated successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding deactivate customer account request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to deactivate customer account'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = deactivateCustomerAccount;