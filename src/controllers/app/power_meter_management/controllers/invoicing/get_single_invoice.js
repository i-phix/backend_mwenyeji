const axios = require('axios');
require('dotenv').config();

const getSingleInvoice = async (request, reply) => {
    try {
        const { invoiceId } = request.params;

        if (!invoiceId) {
            return reply.code(400).send({
                error: 'Invoice ID is required'
            });
        }

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.get(`${powerMeterServiceUrl}/power/invoices/${invoiceId}`);

        return reply.code(200).send({
            message: response.data.message || 'Invoice retrieved successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding get single invoice request:', error);
        
        // Handle axios errors
        if (error.response) {
            // Handle 404 specifically
            if (error.response.status === 404) {
                return reply.code(404).send({
                    error: 'Invoice not found'
                });
            }
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to retrieve invoice'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getSingleInvoice;