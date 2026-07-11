const axios = require('axios');
require('dotenv').config();

const editPowerMeter = async (request, reply) => {
    try {
        const { meterId } = request.params;
        const {
            meterSerialNumber,
            deviceId,
            gatewayId,
            meterReading,
            lastUpdated,
            manufacturer,
            type,
            status
        } = request.body;

        // Basic validation
        if (!meterId) {
            return reply.code(400).send({
                error: 'Meter ID is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Prepare the request payload - only include fields that are provided
        const payload = {};
        
        if (meterSerialNumber !== undefined) payload.meterSerialNumber = meterSerialNumber;
        if (deviceId !== undefined) payload.deviceId = deviceId;
        if (gatewayId !== undefined) payload.gatewayId = gatewayId;
        if (meterReading !== undefined) payload.meterReading = Number(meterReading);
        if (lastUpdated !== undefined) payload.lastUpdated = new Date(lastUpdated);
        if (manufacturer !== undefined) payload.manufacturer = manufacturer;
        if (type !== undefined) payload.type = type;
        if (status !== undefined) payload.status = status;

        // Forward request to Power Meter Service
        const response = await axios.put(`${powerMeterServiceUrl}/edit_power_meter/${meterId}`, payload);

        return reply.code(200).send({
            message: 'Power meter updated successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding edit power meter request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to update power meter'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = editPowerMeter;