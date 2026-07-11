const axios = require('axios');
require('dotenv').config();

const assignUnitToPowerMeter = async (request, reply) => {
    try {
        const { meterId } = request.params;
        const { unitId, unitName } = request.body;

        // Basic validation
        if (!meterId) {
            return reply.code(400).send({
                error: 'Meter ID is required'
            });
        }

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

        // Prepare the request payload
        const payload = {
            unitId: unitId,
            unitName: unitName || ''
        };

        // Forward request to Power Meter Service
        const response = await axios.put(
            `${powerMeterServiceUrl}/assign_unit/${meterId}`, 
            payload
        );

        return reply.code(200).send({
            success: true,
            message: 'Power meter assigned to unit successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding assign unit to power meter request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to assign unit to power meter'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = assignUnitToPowerMeter;