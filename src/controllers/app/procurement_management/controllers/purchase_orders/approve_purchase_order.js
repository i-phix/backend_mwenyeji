const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const approve_purchase_order = async (request, reply) => {
    try {
        const { facilityId, purchaseOrderId } = request.params;
        const { approve, comments = '', userId } = request.body;

        // Validate required inputs
        if (approve === undefined) {
            return reply.code(400).send({
                error: 'Approval decision is required (true for approve, false for reject)'
            });
        }
        if (!userId) {
            return reply.code(400).send({
                error: 'userId is required in the request body'
            });
        }

        // Load the PurchaseOrder model for this facility
        const PurchaseOrderModel = await getModel(
            'PurchaseOrder',
            payservedb.PurchaseOrder.schema,
            facilityId
        );

        // Find the purchase order document
        const purchaseOrder = await PurchaseOrderModel.findById(purchaseOrderId);
        if (!purchaseOrder) {
            return reply.code(404).send({ error: 'Purchase order not found' });
        }

        // Locate the current approval step
        const currentStepIndex = purchaseOrder.approvals.findIndex(
            step => step.stepNumber === purchaseOrder.currentStep
        );
        if (currentStepIndex === -1) {
            return reply.code(400).send({ error: 'Current approval step not found' });
        }
        const currentStep = purchaseOrder.approvals[currentStepIndex];

        // Check that this userId is in the approvers list for the current step
        const approverIndex = currentStep.approvers.findIndex(
            approver => String(approver.userId) === String(userId)
        );
        if (approverIndex === -1) {
            return reply.code(403).send({ error: 'You are not authorized to approve this purchase order' });
        }

        // Ensure they haven't already acted
        if (currentStep.approvers[approverIndex].status !== 'pending') {
            return reply.code(400).send({ error: 'You have already provided your decision' });
        }

        // Record the decision
        currentStep.approvers[approverIndex].status = approve ? 'approved' : 'rejected';
        currentStep.approvers[approverIndex].actionDate = new Date();
        currentStep.approvers[approverIndex].comments = comments;

        // Determine new overall approvalStatus/currentStep
        const allResponded = currentStep.approvers.every(a => a.status !== 'pending');
        if (allResponded) {
            const allApproved = currentStep.approvers.every(a => a.status === 'approved');
            if (allApproved) {
                // advance to next step, or finalize
                const nextExists = purchaseOrder.approvals.some(
                    step => step.stepNumber === purchaseOrder.currentStep + 1
                );
                if (nextExists) {
                    purchaseOrder.currentStep += 1;
                    purchaseOrder.approvalStatus = 'in_progress';
                    purchaseOrder.status = 'pending approval'; // Keep as pending until fully approved
                } else {
                    purchaseOrder.currentStep = null;
                    purchaseOrder.approvalStatus = 'approved';
                    purchaseOrder.status = 'approved'; // Fully approved PO becomes approved
                }
            } else {
                // any rejection => fully rejected
                purchaseOrder.currentStep = null;
                purchaseOrder.approvalStatus = 'rejected';
                purchaseOrder.status = 'rejected';
            }
        } else {
            // still waiting on other approvers
            purchaseOrder.approvalStatus = 'in_progress';
            purchaseOrder.status = 'pending approval';
        }

        // Persist changes
        await purchaseOrder.save();

        // Use global payservedb connection for populate to avoid User schema issues
        const updated = await payservedb.PurchaseOrder
            .findById(purchaseOrderId)
            .populate('approvals.approvers.userId', 'name email')
            .populate('supplier', 'name email contact')
            .lean();

        return reply.code(200).send({
            message: approve ? 'Purchase order approved' : 'Purchase order rejected',
            data: updated
        });
    } catch (err) {
        console.error('Error in approve_purchase_order:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = approve_purchase_order;