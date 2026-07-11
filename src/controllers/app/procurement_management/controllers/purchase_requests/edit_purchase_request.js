const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const edit_purchase_request = async (request, reply) => {
    try {
        const { facilityId, purchaseRequestId } = request.params;
        const {
            items,
            date,
            department,
            status,
            poStatus,
            irfNumber
        } = request.body;

        // Basic validation
        if (!purchaseRequestId) {
            return reply.code(400).send({
                error: 'Purchase request ID is required'
            });
        }

        const purchaseRequestModel = await getModel('PurchaseRequest', payservedb.PurchaseRequest.schema, facilityId);

        // Check if purchase request exists
        const existingRequest = await purchaseRequestModel.findById(purchaseRequestId);
        if (!existingRequest) {
            return reply.code(404).send({
                error: 'Purchase request not found'
            });
        }

        // Check if IRF number is being changed and if new one already exists
        if (irfNumber && irfNumber !== existingRequest.irfNumber) {
            const duplicateIRF = await purchaseRequestModel.findOne({
                irfNumber,
                _id: { $ne: purchaseRequestId }
            });
                    
            if (duplicateIRF) {
                return reply.code(400).send({
                    error: 'Another purchase request with this IRF number already exists'
                });
            }
        }

        // Validate items if provided
        if (items) {
            if (!Array.isArray(items) || items.length === 0) {
                return reply.code(400).send({
                    error: 'At least one item is required'
                });
            }

            // Validate each item
            for (const item of items) {
                if (!item.itemDescription || !item.quantity || !item.unitOfMeasure) {
                    return reply.code(400).send({
                        error: 'Each item must have description, quantity, and unit of measure'
                    });
                }
            }
        }

        // Update the purchase request
        const updateData = {};
        
        if (items) {
            updateData.items = items.map(item => ({
                itemDescription: item.itemDescription,
                quantity: item.quantity,
                unitOfMeasure: item.unitOfMeasure,
                remarksSpecification: item.remarksSpecification || ''
            }));
        }
        
        if (date) updateData.date = date;
        if (department) updateData.department = department;
        if (status) updateData.status = status;
        if (poStatus) updateData.poStatus = poStatus;
        if (irfNumber) updateData.irfNumber = irfNumber;

        const savedPurchaseRequest = await purchaseRequestModel.findByIdAndUpdate(
            purchaseRequestId,
            { $set: updateData },
            { new: true }
        );

        return reply.code(200).send({
            message: 'Purchase request updated successfully',
            data: savedPurchaseRequest
        });
    } catch (err) {
        console.error('Error in updating purchase request:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = edit_purchase_request;