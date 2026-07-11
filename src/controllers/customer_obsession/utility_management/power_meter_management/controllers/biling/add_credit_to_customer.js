const axios = require('axios');
const logger = require('../../../../../../config/winston');

const addAccCredit = async (request, reply) => {
    try {
        const { amount, reason, ref, type, time, accountNo } = request.body;

        // Validate required parameters
        if (!accountNo) {
            throw new Error('Account number is required');
        }

        if (!amount || amount <= 0) {
            throw new Error('Valid amount is required');
        }

        if (!ref) {
            throw new Error('Reference number is required');
        }

        // Prepare payload for the billing service
        const payload = {
            account_no: accountNo,
            amount: amount,
            reason: reason,
            type: type,
            ref: ref,
            time: time || new Date().toLocaleTimeString('en-US', { hour12: false })
        };

        // Make request to the billing service
        const response = await axios.post(
            `${process.env.POWER_BILLING_SERVICE_APP_URL}/credit`,
            payload
        );

        // Return the response from the billing service
        return reply.code(200).send({
            success: true,
            message: "Credit added successfully",
            data: response.data
        });
    } catch (err) {
        logger.error('Error in addAccCredit:', {
            error: err.message,
            stack: err.stack,
            params: {
                accountNo: request.params.accountNo
            },
            body: request.body
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

module.exports = addAccCredit;