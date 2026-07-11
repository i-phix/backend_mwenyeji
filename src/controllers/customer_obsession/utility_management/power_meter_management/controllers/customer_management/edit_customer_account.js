const axios = require('axios');
require('dotenv').config();

const editCustomerAccount = async (request, reply) => {
    try {
        const { accountId } = request.params;
        const updateData = request.body;

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.put(`${powerMeterServiceUrl}/edit_customer_account/${accountId}`, updateData);

        return reply.code(200).send({
            message: 'Customer account updated successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding edit customer account request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to update customer account'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = editCustomerAccount;