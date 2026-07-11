const axios = require('axios');
require('dotenv').config();

const getPowerSettings = async (request, reply) => {
    try {
        // Extract facility ID from request parameters
        const { facilityId } = request.params;
        
        // Validate facility ID
        if (!facilityId) {
            return reply.code(400).send({
                error: 'Facility ID is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service with facility ID
        const response = await axios.get(`${powerMeterServiceUrl}/get_power_settings/${facilityId}`);

        // Check if the service returned default settings or actual settings
        const isDefaultSettings = response.data.message && response.data.message.includes('default');
        const hasActualData = response.data.data && response.data.data._id;

        return reply.code(200).send({
            message: response.data.message || 'Power meter settings retrieved successfully',
            data: response.data.data || response.data,
            configurationStatus: response.data.configurationStatus || null,
            isConfigured: response.data.isConfigured || null,
            isDefault: isDefaultSettings || !hasActualData
        });

    } catch (error) {
        console.error('Error forwarding get power settings request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get power meter settings'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getPowerSettings;