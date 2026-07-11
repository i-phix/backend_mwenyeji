const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const add_purchase_request = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            items,
            date,
            department,
            userName,
        } = request.body;
        
        // Validation
        if (!items || !Array.isArray(items) || items.length === 0) {
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
        
        const purchaseRequestModel = await getModel('PurchaseRequest', payservedb.PurchaseRequest.schema, facilityId);
        
        // Get the Approval Workflow model
        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);
        
        // Find the purchase request approval workflow for this facility
        const approvalWorkflow = await approvalWorkflowModel.findOne({ 
            module: 'purchase_requests', 
            facilityId 
        }).lean();
        
        if (!approvalWorkflow) {
            return reply.code(400).send({
                error: 'No approval workflow configured for purchase requests in this facility'
            });
        }
        
        // Generate IRF number
        const highestIrfDoc = await purchaseRequestModel
            .findOne({ irfNumber: { $regex: /^IRF-\d{4}$/ } })
            .sort({ irfNumber: -1 })
            .lean();
            
        let nextIrfNumber = 'IRF-0001';
            
        if (highestIrfDoc) {
            const currentNumber = parseInt(highestIrfDoc.irfNumber.split('-')[1]);
            const nextNumber = (currentNumber + 1).toString().padStart(4, '0');
            nextIrfNumber = `IRF-${nextNumber}`;
        }
        
        // Format the approval steps from the workflow
        // Store user IDs as strings to avoid User model dependency
        const approvals = approvalWorkflow.steps.map(step => ({
            stepNumber: step.stepNumber,
            stepName: step.name,
            approvers: step.approvers.map(approverId => ({
                userId: approverId.toString(), // Convert ObjectId to string
                status: 'pending',
                actionDate: null,
                comments: ''
            }))
        }));
        
        // Create the new purchase request document
        const newPurchaseRequest = {
            facilityId,
            items: items.map(item => ({
                itemDescription: item.itemDescription,
                quantity: item.quantity,
                unitOfMeasure: item.unitOfMeasure,
                remarksSpecification: item.remarksSpecification || ''
            })),
            date: date || new Date(),
            irfNumber: nextIrfNumber,
            department: department || '',
            from: userName || '',
            status: 'pending',
            poStatus: 'pending',
            
            // Add approval workflow fields
            approvalWorkflowId: approvalWorkflow._id,
            approvalStatus: 'pending',
            currentStep: 1,
            approvals: approvals
        };
        
        const savedPurchaseRequest = await purchaseRequestModel.create(newPurchaseRequest);
        
        // Return without populating for now to avoid User model issues
        return reply.code(200).send({
            message: 'Purchase request added successfully',
            data: savedPurchaseRequest
        });
    } catch (err) {
        console.error('Error in adding purchase request:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = add_purchase_request;