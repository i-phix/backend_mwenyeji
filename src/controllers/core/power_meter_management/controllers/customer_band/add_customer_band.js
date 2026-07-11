const axios = require('axios');
require('dotenv').config();

const addCustomerBand = async (request, reply) => {
    try {
        const { name } = request.body;

        // Basic validation
        if (!name) {
            return reply.code(400).send({
                error: 'Customer Band name is required'
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
        const response = await axios.post(`${powerMeterServiceUrl}/add_customer_band`, {
            name
        });

        return reply.code(200).send({
            message: 'Customer band added successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding add customer band request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to add customer band'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = addCustomerBand;