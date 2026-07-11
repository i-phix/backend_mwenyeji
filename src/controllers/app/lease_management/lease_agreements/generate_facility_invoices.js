const axios = require('axios');
require('dotenv').config();

const forwardTriggerFacilityInvoicing = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const payload = request.body;

        // Basic validation
        if (!facilityId) {
            return reply.code(400).send({
                error: 'facilityId is required in the URL parameter'
            });
        }

        if (!payload || !payload.invoiceTypes) {
            return reply.code(400).send({
                error: 'Request body with invoiceTypes is required'
            });
        }

        // Get Invoice Service URL from environment variables
        const invoiceServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;

        if (!invoiceServiceUrl) {
            return reply.code(500).send({
                error: 'Invoice Service URL not configured'
            });
        }

        console.log('Forwarding facility invoice trigger request:', {
            facilityId,
            payload
        });

        // Forward request to Invoice Service
        const response = await axios.post(
            `${invoiceServiceUrl}/facilities/${facilityId}/trigger-invoicing`,
            payload
        );

        return reply.code(200).send({
            message: 'Facility invoice trigger request sent successfully',
            data: response.data
        });

    } catch (error) {
        console.error('Error forwarding facility invoice trigger request:', error);

        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to trigger facility invoicing'
            });
        }

        return reply.code(502).send({
            error: 'Failed to communicate with Invoice Service'
        });
    }
};

module.exports = forwardTriggerFacilityInvoicing;
