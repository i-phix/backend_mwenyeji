const axios = require('axios');
require('dotenv').config();

const getAllPowerCharges = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            search = '',
            yearMonth = '',
            minTotalCharge = '',
            maxTotalCharge = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = request.query;

        // Basic validation
        if (!facilityId) {
            return reply.code(400).send({
                error: 'facilityId is required'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Prepare query parameters
        const queryParams = new URLSearchParams({
            search,
            yearMonth,
            minTotalCharge,
            maxTotalCharge,
            sortBy,
            sortOrder
        }).toString();

        // Forward request to Power Meter Service
        const response = await axios.get(
            `${powerMeterServiceUrl}/get_all_power_charges/${facilityId}?${queryParams}`
        );

        return reply.code(200).send({
            message: 'Power charges fetched successfully',
            data: response.data.data,
            summaryStats: response.data.summaryStats
        });

    } catch (error) {
        console.error('Error forwarding get power charges request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to fetch power charges'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getAllPowerCharges;