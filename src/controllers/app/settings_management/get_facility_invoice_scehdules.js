const axios = require('axios');
require('dotenv').config();

const getAllInvoiceSchedules = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Basic validation
        if (!facilityId) {
            return reply.code(400).send({
                error: 'facilityId is required'
            });
        }

        // Get the Invoice Schedule Service base URL from environment variables
        const invoiceScheduleServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;
        
        if (!invoiceScheduleServiceUrl) {
            return reply.code(500).send({
                error: 'Invoice Schedule Service URL not configured'
            });
        }

        // Forward request to Invoice Schedule Service (no query params)
        const response = await axios.get(
            `${invoiceScheduleServiceUrl}/get_invoice_schedules/${facilityId}`
        );

        return reply.code(200).send({
            message: 'Invoice schedules fetched successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding get invoice schedules request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to fetch invoice schedules'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Invoice Schedule Service'
        });
    }
};

module.exports = getAllInvoiceSchedules;