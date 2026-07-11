const axios = require('axios');
require('dotenv').config();

const getUnitMeterDetails = async (request, reply) => {
    try {
        const { unitId } = request.params;

        // Basic validation
        if (!unitId) {
            return reply.code(400).send({
                error: 'Unit ID is required'
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
        const response = await axios.get(`${powerMeterServiceUrl}/get_unit_meter/${unitId}`);

        return reply.code(200).send({
            success: true,
            message: 'Unit meter details retrieved successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding get unit meter details request:', error);
        
        // Handle axios errors
        if (error.response) {
            // If it's a 404 from the service, maintain the same response structure
            if (error.response.status === 404) {
                return reply.code(404).send({
                    success: false,
                    error: error.response.data.error || 'No power meter found for this unit',
                    data: null
                });
            }
            
            return reply.code(error.response.status).send({
                success: false,
                error: error.response.data.error || 'Failed to get unit meter details'
            });
        }
        
        return reply.code(502).send({
            success: false,
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getUnitMeterDetails;