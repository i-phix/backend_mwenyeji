const axios = require('axios');
require('dotenv').config();

const forwardGenerateTenantInvoice = async (request, reply) => {
    try {
        const { facilityId, contractId, contractType, options } = request.body;

        // Basic validation
        if (!facilityId) {
            return reply.code(400).send({
                error: 'facilityId is required'
            });
        }

        if (!contractId) {
            return reply.code(400).send({
                error: 'contractId is required'
            });
        }

        if (!contractType) {
            return reply.code(400).send({
                error: 'contractType is required'
            });
        }

        // Get the Invoice Service base URL from environment variables
        const invoiceServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;
        
        if (!invoiceServiceUrl) {
            return reply.code(500).send({
                error: 'Invoice Service URL not configured'
            });
        }

        console.log('Forwarding tenant invoice generation request:', {
            facilityId,
            contractId,
            contractType,
            options
        });

        // Forward request to Invoice Service
        const response = await axios.post(
            `${invoiceServiceUrl}/generate-single`,
            {
                facilityId,
                contractId,
                contractType,
                options: options || {}
            }
        );

        return reply.code(200).send({
            message: 'Tenant invoice generated successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding tenant invoice generation request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to generate tenant invoice'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Invoice Service'
        });
    }
};

module.exports = forwardGenerateTenantInvoice;