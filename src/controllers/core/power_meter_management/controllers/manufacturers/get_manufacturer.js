const axios = require('axios');
require('dotenv').config();

const getManufacturer = async (request, reply) => {
    try {
        const { manufacturerId } = request.params;

        // Basic validation
        if (!manufacturerId) {
            return reply.code(400).send({
                error: 'Manufacturer ID is required'
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
        const response = await axios.get(`${powerMeterServiceUrl}/get_meter_manufacturer/${manufacturerId}`);

        return reply.code(200).send({
            message: 'Manufacturer retrieved successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding get manufacturer request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get manufacturer'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getManufacturer;