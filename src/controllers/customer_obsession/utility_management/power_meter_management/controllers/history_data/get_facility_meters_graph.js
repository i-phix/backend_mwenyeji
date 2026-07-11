const axios = require('axios');
require('dotenv').config();

const getPowerMonthlyUsage = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { month, year } = request.query;

        // Basic validation
        if (!facilityId) {
            return reply.code(400).send({
                error: 'Facility ID is required'
            });
        }

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Build query parameters
        const queryParams = new URLSearchParams();
        if (month) queryParams.append('month', month);
        if (year) queryParams.append('year', year);
        
        const queryString = queryParams.toString();
        const url = `${powerMeterServiceUrl}/power_usage_monthly_graph/${facilityId}/${queryString ? `?${queryString}` : ''}`;

        // Forward request to Power Meter Service
        const response = await axios.get(url);

        return reply.code(200).send({
            message: 'Power monthly usage retrieved successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding power monthly usage request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get power monthly usage'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getPowerMonthlyUsage;