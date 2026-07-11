const axios = require('axios');
require('dotenv').config();

const deleteManufacturer = async (request, reply) => {
    try {
        const { manufacturerId } = request.params;

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

        // Forward delete request to Power Meter Service
        const response = await axios.delete(`${powerMeterServiceUrl}/delete_meter_manufacturer/${manufacturerId}`);

        return reply.code(200).send({
            message: 'Power meter manufacturer deleted successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding delete manufacturer request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to delete manufacturer'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = deleteManufacturer;
