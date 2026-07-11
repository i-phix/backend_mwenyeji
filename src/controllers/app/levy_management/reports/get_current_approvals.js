const axios = require('axios');
require('dotenv').config();

/**
 * Get the most recent invoice generation approval entry
 * This function forwards the request to the Invoice Service
 */
const getCurrentApprovalEntry = async (request, reply) => {
    try {
        const { facilityId, invoiceType } = request.params;

        // Validate invoiceType
        if (!['levy', 'lease'].includes(invoiceType.toLowerCase())) {
            return reply.code(400).send({
                error: 'Invalid invoice type. Must be "levy" or "lease"'
            });
        }

        // Get the Invoice Service base URL from environment variables
        const invoiceServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;
        
        if (!invoiceServiceUrl) {
            return reply.code(500).send({
                error: 'Invoice Service URL not configured'
            });
        }

        console.log(`Fetching current approval entry for facility: ${facilityId}, type: ${invoiceType}`);

        // Forward request to Invoice Service
        const response = await axios.get(
            `${invoiceServiceUrl}/invoice-approvals/${facilityId}/${invoiceType}/current`
        );

        return reply.code(200).send({
            message: 'Approval entry fetched successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error fetching current approval entry:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to fetch approval entry',
                details: error.response.data.details
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Invoice Service'
        });
    }
};

module.exports = getCurrentApprovalEntry;