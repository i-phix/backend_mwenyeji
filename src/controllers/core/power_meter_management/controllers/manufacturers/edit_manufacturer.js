const axios = require('axios');
require('dotenv').config();

const editManufacturer = async (request, reply) => {
    try {
        const { manufacturerId } = request.params;
        const { name } = request.body;

        // Basic validation
        if (!manufacturerId) {
            return reply.code(400).send({
                error: 'Manufacturer ID is required'
            });
        }

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
        const response = await axios.put(`${powerMeterServiceUrl}/edit_meter_manufacturer/${manufacturerId}`, {
            name
        });

        return reply.code(200).send({
            message: 'Manufacturer updated successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding edit manufacturer request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to update manufacturer'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = editManufacturer;