const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_purchase_request = async (request, reply) => {
    try {
        const { facilityId, purchaseRequestId } = request.params;

        // Basic validation
        if (!purchaseRequestId) {
            return reply.code(400).send({
                error: 'Purchase request ID is required'
            });
        }

        const purchaseRequestModel = await getModel('PurchaseRequest', payservedb.PurchaseRequest.schema, facilityId);

        // Find the purchase request
        const purchaseRequest = await purchaseRequestModel.findById(purchaseRequestId);
                
        if (!purchaseRequest) {
            return reply.code(404).send({
                error: 'Purchase request not found'
            });
        }

        return reply.code(200).send({
            message: 'Purchase request retrieved successfully',
            data: purchaseRequest
        });
    } catch (err) {
        console.error('Error in getting purchase request:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_purchase_request;