const axios = require('axios');
const logger = require('../../../../../config/winston');

const getAccountCredits = async (request, reply) => {
    try {
        const { accountId } = request.params;

        // Validate required parameters
        if (!accountId) {
            throw new Error('Account ID is required');
        }

        // Make request to the billing service using the URL from environment variables
        const response = await axios.get(`${process.env.BILLING_SERVICE_URL}/credits/${accountId}`);

        // Return the response from the billing service
        return reply.code(200).send(response.data);
    } catch (err) {
        logger.error('Error in getAccountCredits:', {
            error: err.message,
            stack: err.stack,
            params: {
                accountId: request.params.accountId
            }
        });
        
        // Handle errors from the billing service or other issues
        const statusCode = err.response?.status || 400;
        const errorMessage = err.response?.data?.error || err.message;
        
        return reply.code(statusCode).send({
            success: false,
            error: errorMessage
        });
    }
};

module.exports = getAccountCredits;