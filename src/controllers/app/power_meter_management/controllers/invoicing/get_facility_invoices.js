const axios = require('axios');
require('dotenv').config();

const getFacilityInvoices = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { status, yearMonth, page = 1, limit = 20 } = request.query;

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

        // Build query string
        const queryParams = new URLSearchParams();
        if (status) queryParams.append('status', status);
        if (yearMonth) queryParams.append('yearMonth', yearMonth);
        if (page) queryParams.append('page', page);
        if (limit) queryParams.append('limit', limit);
        
        const queryString = queryParams.toString();
        const url = `${powerMeterServiceUrl}/power/invoices/facility/${facilityId}${queryString ? `?${queryString}` : ''}`;

        // Forward request to Power Meter Service
        const response = await axios.get(url);

        return reply.code(200).send({
            message: response.data.message || 'Facility invoices retrieved successfully',
            data: response.data.data || response.data,
            count: response.data.count,
            total: response.data.total,
            page: response.data.page,
            pages: response.data.pages
        });

    } catch (error) {
        console.error('Error forwarding get facility invoices request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to retrieve facility invoices'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getFacilityInvoices;