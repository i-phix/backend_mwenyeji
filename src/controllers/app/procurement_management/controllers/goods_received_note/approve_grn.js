const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const approve_goods_received_note = async (request, reply) => {
    try {
        const { facilityId, grnId } = request.params;
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

        // Load the GoodsReceivedNote model for this facility
        const GoodsReceivedNoteModel = await getModel(
            'GoodsReceivedNote',
            payservedb.GoodsReceivedNote.schema,
            facilityId
        );

        // Find the goods received note document
        const goodsReceivedNote = await GoodsReceivedNoteModel.findById(grnId);
        if (!goodsReceivedNote) {
            return reply.code(404).send({ error: 'Goods received note not found' });
        }

        // Check if already fully approved or rejected
        if (goodsReceivedNote.approvalStatus === 'approved') {
            return reply.code(400).send({ error: 'This goods received note is already approved' });
        }
        if (goodsReceivedNote.approvalStatus === 'rejected') {
            return reply.code(400).send({ error: 'This goods received note has been rejected' });
        }

        // Locate the current approval step
        const currentStepIndex = goodsReceivedNote.approvals.findIndex(
            step => step.stepNumber === goodsReceivedNote.currentStep
        );
        if (currentStepIndex === -1) {
            return reply.code(400).send({ error: 'Current approval step not found' });
        }
        const currentStep = goodsReceivedNote.approvals[currentStepIndex];

        // Check that this userId is in the approvers list for the current step
        const approverIndex = currentStep.approvers.findIndex(
            approver => String(approver.userId) === String(userId)
        );
        if (approverIndex === -1) {
            return reply.code(403).send({ error: 'You are not authorized to approve this goods received note' });
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
                // Check if there's a next step
                const nextExists = goodsReceivedNote.approvals.some(
                    step => step.stepNumber === goodsReceivedNote.currentStep + 1
                );
                if (nextExists) {
                    // Advance to next step
                    goodsReceivedNote.currentStep += 1;
                    goodsReceivedNote.approvalStatus = 'in_progress';
                } else {
                    // Fully approved - no more steps
                    goodsReceivedNote.currentStep = null;
                    goodsReceivedNote.approvalStatus = 'approved';
                }
            } else {
                // Any rejection means fully rejected
                goodsReceivedNote.currentStep = null;
                goodsReceivedNote.approvalStatus = 'rejected';
            }
        } else {
            // Still waiting on other approvers in current step
            goodsReceivedNote.approvalStatus = 'in_progress';
        }

        // Persist changes
        await goodsReceivedNote.save();

        // Populate the updated document for response
        const populatedGRN = await GoodsReceivedNoteModel
            .findById(grnId)
            .populate('supplier', 'name email contact')
            .populate('receivedBy', 'name email')
            .populate('poId', 'poNumber department items grandTotal')
            .populate('approvals.approvers.userId', 'name email')
            .lean();

        // Format approval progress for response
        const approvalProgress = {
            currentStep: populatedGRN.currentStep,
            totalSteps: populatedGRN.approvals.length,
            percentage: populatedGRN.approvalStatus === 'approved' ? 100 : 
                       populatedGRN.approvalStatus === 'rejected' ? 0 :
                       populatedGRN.currentStep > populatedGRN.approvals.length ? 100 :
                       ((populatedGRN.currentStep - 1) / populatedGRN.approvals.length) * 100,
            status: populatedGRN.approvalStatus
        };

        return reply.code(200).send({
            message: approve ? 'Goods received note approved successfully' : 'Goods received note rejected',
            data: {
                ...populatedGRN,
                approvalProgress
            },
            approvalComplete: populatedGRN.approvalStatus === 'approved' || populatedGRN.approvalStatus === 'rejected'
        });
    } catch (err) {
        console.error('Error in approve_goods_received_note:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = approve_goods_received_note;