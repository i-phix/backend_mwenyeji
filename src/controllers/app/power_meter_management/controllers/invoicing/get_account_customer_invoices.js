const axios = require('axios');
require('dotenv').config();

const getAccountCustomerInvoices = async (request, reply) => {
    try {
        const { accountNumber, customerId } = request.params;
        const { status, yearMonth } = request.query;

        if (!accountNumber || !customerId) {
            return reply.code(400).send({
                error: 'Account number and Customer ID are both required'
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
        
        const queryString = queryParams.toString();
        const url = `${powerMeterServiceUrl}/power/invoices/account/${accountNumber}/customer/${customerId}${queryString ? `?${queryString}` : ''}`;

        // Forward request to Power Meter Service
        const response = await axios.get(url);

        return reply.code(200).send({
            message: response.data.message || 'Account invoices retrieved successfully',
            data: response.data.data || response.data,
            count: response.data.count
        });

    } catch (error) {
        console.error('Error forwarding get account customer invoices request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to retrieve account invoices'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getAccountCustomerInvoices;