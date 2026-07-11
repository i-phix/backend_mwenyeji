const axios = require('axios');
require('dotenv').config();

const addInvoiceSchedule = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            invoiceType,
            nextInvoiceDate,
            isAutomatic
        } = request.body;

        // Validate date format
        const invoiceDate = new Date(nextInvoiceDate);
        if (isNaN(invoiceDate.getTime())) {
            return reply.code(400).send({
                error: 'Invalid date format for next invoice date'
            });
        }

        // Get the Invoice Schedule Service base URL from environment variables
        const invoiceScheduleServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;
                
        if (!invoiceScheduleServiceUrl) {
            return reply.code(500).send({
                error: 'Invoice Schedule Service URL not configured'
            });
        }

        // Prepare the request payload
        const payload = {
            invoiceType: invoiceType.trim(),
            nextInvoiceDate: invoiceDate.toISOString(),
            isAutomatic: isAutomatic
        };

        console.log('Payload to save:', payload);

        // Forward request to Invoice Schedule Service
        const response = await axios.post(
            `${invoiceScheduleServiceUrl}/add_invoice_schedule/${facilityId}`, 
            payload
        );

        return reply.code(200).send({
            message: 'Invoice schedule added successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding add invoice schedule request:', error);
                
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to add invoice schedule'
            });
        }
                
        return reply.code(502).send({
            error: 'Failed to communicate with Invoice Schedule Service'
        });
    }
};

module.exports = addInvoiceSchedule;