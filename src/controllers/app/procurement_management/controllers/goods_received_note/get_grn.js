const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_single_goods_received_note = async (request, reply) => {
    try {
        const { facilityId, grnId } = request.params;

        const goodsReceivedNoteModel = await getModel('GoodsReceivedNote', payservedb.GoodsReceivedNote.schema, facilityId);

        // Find the goods received note with full population
        const goodsReceivedNote = await goodsReceivedNoteModel
            .findById(grnId)
            .populate('supplier', 'name email contact address')
            .populate('receivedBy', 'name email')
            .populate({
                path: 'poId',
                select: 'poNumber department items grandTotal subtotal taxTotal currency date supplierNotes internalNotes budget',
                populate: {
                    path: 'supplier',
                    select: 'name email contact address'
                }
            })
            .populate('approvals.approvers.userId', 'name email')
            .populate('approvalWorkflowId', 'name steps module')
            .lean();

        if (!goodsReceivedNote) {
            return reply.code(404).send({
                success: false,
                error: 'Goods received note not found'
            });
        }

        // Format the response data
        const formattedGRN = {
            ...goodsReceivedNote,
            supplierInfo: goodsReceivedNote.supplier,
            receivedByInfo: goodsReceivedNote.receivedBy,
            purchaseOrderInfo: goodsReceivedNote.poId,
            
            // Calculate approval progress
            approvalProgress: {
                currentStep: goodsReceivedNote.currentStep,
                totalSteps: goodsReceivedNote.approvals.length,
                percentage: goodsReceivedNote.approvalStatus === 'approved' ? 100 : 
                           goodsReceivedNote.approvalStatus === 'rejected' ? 0 :
                           goodsReceivedNote.currentStep > goodsReceivedNote.approvals.length ? 100 :
                           ((goodsReceivedNote.currentStep - 1) / goodsReceivedNote.approvals.length) * 100,
                status: goodsReceivedNote.approvalStatus
            },

            // Format approval steps with user details
            approvalSteps: goodsReceivedNote.approvals.map(step => ({
                ...step,
                isCurrentStep: step.stepNumber === goodsReceivedNote.currentStep,
                isCompleted: goodsReceivedNote.currentStep > step.stepNumber || goodsReceivedNote.approvalStatus === 'approved',
                approvers: step.approvers.map(approver => ({
                    ...approver,
                    userInfo: approver.userId,
                    canApprove: approver.status === 'pending' && step.stepNumber === goodsReceivedNote.currentStep
                }))
            })),

            // Additional calculated fields
            summary: {
                poQuantity: goodsReceivedNote.poQuantity,
                quantityReceived: goodsReceivedNote.quantityReceived,
                receivedPercentage: goodsReceivedNote.poQuantity > 0 ? 
                    (goodsReceivedNote.quantityReceived / goodsReceivedNote.poQuantity) * 100 : 0,
                remainingQuantity: Math.max(0, goodsReceivedNote.poQuantity - goodsReceivedNote.quantityReceived),
                hasAttachments: goodsReceivedNote.files && goodsReceivedNote.files.length > 0,
                attachmentCount: goodsReceivedNote.files ? goodsReceivedNote.files.length : 0
            }
        };

        return reply.code(200).send({
            success: true,
            message: 'Goods received note retrieved successfully',
            data: formattedGRN
        });
    } catch (err) {
        console.error('Error in getting single goods received note:', err);
        return reply.code(500).send({ 
            success: false,
            error: err.message 
        });
    }
};

module.exports = get_single_goods_received_note;