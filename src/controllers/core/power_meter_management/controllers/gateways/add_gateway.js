const axios = require('axios');
require('dotenv').config();

const addPowerMeterGateway = async (request, reply) => {
    try {
        const {
            facilityId,
            gatewayName,
            gatewayId,
            location,
            manufacturer,
            type,
            status
        } = request.body;

        // Basic validation
        if (!facilityId || !gatewayName || !location || !status) {
            return reply.code(400).send({
                error: 'Facility ID, gateway name, location, and status are required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;

        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Prepare the request payload
        const payload = {
            facilityId,
            gatewayName,
            gatewayId: gatewayId || undefined,
            manufacturer,
            type: type || undefined,
            status
        };

        // Forward request to Power Meter Service
        const response = await axios.post(`${powerMeterServiceUrl}/add_gateway`, payload);

        return reply.code(200).send({
            message: 'Power meter gateway added successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding add power meter gateway request:', error);

        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to add power meter gateway'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = addPowerMeterGateway;