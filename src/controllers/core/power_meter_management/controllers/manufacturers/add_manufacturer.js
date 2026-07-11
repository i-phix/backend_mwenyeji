const axios = require('axios');
require('dotenv').config();

const addManufacturer = async (request, reply) => {
    try {
        const { name } = request.body;

        // Basic validation
        if (!name) {
            return reply.code(400).send({
                error: 'Manufacturer name is required'
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
        const response = await axios.post(`${powerMeterServiceUrl}/add_meter_manufacturer`, {
            name
        });

        return reply.code(200).send({
            message: 'Power meter manufacturer added successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding add manufacturer request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to add manufacturer'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = addManufacturer;