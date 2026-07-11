const axios = require('axios');
require('dotenv').config();

/**
 * Approve or Reject invoice generation and trigger invoice creation
 * This function forwards the request to the Invoice Service
 */
const processApprovalAction = async (request, reply) => {
    try {
        const { approvalId } = request.params;
        const { 
            action, 
            userId, 
            userName, 
            comments, 
            reason, 
            deviceInfo = {},
            priority = 5,
            delay = 0
        } = request.body;

        // Validate action
        if (!['approve', 'reject'].includes(action?.toLowerCase())) {
            return reply.code(400).send({
                error: 'Invalid action. Must be "approve" or "reject"'
            });
        }

        // Validate required fields
        if (!userId || !userName) {
            return reply.code(400).send({
                error: 'userId and userName are required'
            });
        }

        // Validate rejection reason
        if (action.toLowerCase() === 'reject' && !reason) {
            return reply.code(400).send({
                error: 'Reason is required for rejection'
            });
        }

        // Get the Invoice Service base URL from environment variables
        const invoiceServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;
        
        if (!invoiceServiceUrl) {
            return reply.code(500).send({
                error: 'Invoice Service URL not configured'
            });
        }

        // Prepare the request payload
        const payload = {
            action: action.toLowerCase(),
            userId,
            userName,
            comments: comments || '',
            reason: reason || '',
            deviceInfo: {
                deviceId: deviceInfo.deviceId || 'unknown',
                deviceType: deviceInfo.deviceType || 'web',
                ipAddress: deviceInfo.ipAddress || request.ip || 'unknown'
            },
            priority,
            delay
        };

        console.log(`Processing ${action} for approval: ${approvalId}`);
        console.log('Payload:', payload);

        // Forward request to Invoice Service
        const response = await axios.post(
            `${invoiceServiceUrl}/invoice-approvals/${approvalId}/action`,
            payload
        );

        return reply.code(200).send({
            message: response.data.message,
            data: response.data.data
        });

    } catch (error) {
        console.error('Error processing approval action:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to process approval action',
                details: error.response.data.details
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Invoice Service'
        });
    }
};

module.exports = processApprovalAction;