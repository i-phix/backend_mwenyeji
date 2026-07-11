const axios = require('axios');
require('dotenv').config();

const addPowerMeter = async (request, reply) => {
    try {
        const {
            facilityId,
            meterSerialNumber,
            deviceId,
            gatewayId,
            previousMeterReading,
            lastUpdated,
            manufacturer,
            type,
            meterStatus,      // Changed from liveStatus to meterStatus
            unitId,
            accountNumber,
            communicationProtocol,
            mqttId
        } = request.body;

        // Basic validation - removed liveStatus requirement, made meterStatus optional
        if (!facilityId || !meterSerialNumber || previousMeterReading === undefined || !lastUpdated || !manufacturer) {
            return reply.code(400).send({
                error: 'Facility ID, meter serial number, previous meter reading, last updated, and manufacturer are required'
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
            meterSerialNumber,
            previousMeterReading: Number(previousMeterReading),
            lastUpdated: new Date(lastUpdated),
            manufacturer,
            type: type || '2 phase', // Default to 2 phase
            meterStatus: meterStatus || 'installed' // Default to installed, optional field
        };

        // Add optional fields if they are provided
        if (deviceId) {
            payload.deviceId = Number(deviceId);
        }

        if (gatewayId) {
            payload.gatewayId = Number(gatewayId);
        }

        if (unitId) {
            payload.unitId = unitId;
        }

        if (accountNumber) {
            payload.accountNumber = Number(accountNumber);
        }

        if (communicationProtocol) {
            payload.communicationProtocol = communicationProtocol;
        }

        if (mqttId) {
            payload.mqttId = mqttId;
        }

        // Forward request to Power Meter Service
        const response = await axios.post(`${powerMeterServiceUrl}/add_power_meter`, payload);

        return reply.code(200).send({
            success: true,
            message: 'Power meter added successfully',
            data: response.data.data,
            accountNumber: response.data.accountNumber
        });

    } catch (error) {
        console.error('Error forwarding add power meter request:', error);

        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                success: false,
                error: error.response.data.error || 'Failed to add power meter'
            });
        }

        return reply.code(502).send({
            success: false,
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = addPowerMeter;