const axios = require('axios');
require('dotenv').config();

/**
 * Get all approval entries for a facility with optional filters
 * This function forwards the request to the Invoice Service
 */
const getAllApprovalEntries = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { status, invoiceType } = request.query;

        // Get the Invoice Service base URL from environment variables
        const invoiceServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;
        
        if (!invoiceServiceUrl) {
            return reply.code(500).send({
                error: 'Invoice Service URL not configured'
            });
        }

        // Build query parameters
        const queryParams = new URLSearchParams();
        if (status) queryParams.append('status', status);
        if (invoiceType) queryParams.append('invoiceType', invoiceType);

        const queryString = queryParams.toString();
        const url = `${invoiceServiceUrl}/invoice-approvals/${facilityId}${queryString ? '?' + queryString : ''}`;

        console.log(`Fetching all approval entries for facility: ${facilityId}`);
        if (queryString) console.log(`Filters: ${queryString}`);

        // Forward request to Invoice Service
        const response = await axios.get(url);

        return reply.code(200).send({
            message: 'Approval entries fetched successfully',
            count: response.data.count,
            data: response.data.data
        });

    } catch (error) {
        console.error('Error fetching approval entries:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to fetch approval entries',
                details: error.response.data.details
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Invoice Service'
        });
    }
};

module.exports = getAllApprovalEntries;