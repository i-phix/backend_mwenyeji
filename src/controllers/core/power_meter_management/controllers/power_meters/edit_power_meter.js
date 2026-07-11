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
            type,
            facilityId,
            lastUpdated
        } = request.body;

        console.log('Received edit request for meter ID:', meterId);
        console.log('Request body:', request.body);

        // Basic validation
        if (!meterId) {
            return reply.code(400).send({
                error: 'Meter ID is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;
                
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Prepare the request payload - only include fields that are provided
        const payload = {};
                
        if (meterSerialNumber !== undefined && meterSerialNumber !== null) {
            payload.meterSerialNumber = meterSerialNumber;
        }
        if (deviceId !== undefined && deviceId !== null && deviceId !== '') {
            payload.deviceId = deviceId;
        }
        if (gatewayId !== undefined && gatewayId !== null) {
            payload.gatewayId = gatewayId;
        }
        if (meterReading !== undefined && meterReading !== null && meterReading !== '') {
            payload.meterReading = Number(meterReading);
        }
        if (type !== undefined && type !== null) {
            payload.type = type;
        }
        if (facilityId !== undefined && facilityId !== null) {
            payload.facilityId = facilityId;
        }
        if (lastUpdated !== undefined && lastUpdated !== null) {
            payload.lastUpdated = new Date(lastUpdated);
        }

        console.log('Payload being sent to service:', payload);

        // Forward request to Power Meter Service
        const response = await axios.put(`${powerMeterServiceUrl}/edit_power_meter/${meterId}`, payload);

        console.log('Service response:', response.data);

        return reply.code(200).send({
            message: 'Power meter updated successfully',
            success: true,
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding edit power meter request:', error);
                
        // Handle axios errors
        if (error.response) {
            console.error('Service error response:', error.response.data);
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