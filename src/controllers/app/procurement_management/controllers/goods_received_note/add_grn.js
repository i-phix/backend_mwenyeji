const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../../../utils/getModel');

const add_goods_received_note = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            purchaseOrderId,
            poNumber,
            quantityReceived,
            receivedBy,
            receivedDate,
            description,
            notes
        } = request.body;

        // Basic validation
        if (!purchaseOrderId || !poNumber || !quantityReceived || !receivedBy) {
            return reply.code(400).send({
                error: 'Purchase Order ID, PO Number, quantity received, and received by are required'
            });
        }

        // Validate quantity is positive
        if (quantityReceived <= 0) {
            return reply.code(400).send({
                error: 'Quantity received must be greater than 0'
            });
        }

        const goodsReceivedNoteModel = await getModel('GoodsReceivedNote', payservedb.GoodsReceivedNote.schema, facilityId);
        const purchaseOrderModel = await getModel('PurchaseOrder', payservedb.PurchaseOrder.schema, facilityId);

        // Validate Purchase Order exists and is approved
        const purchaseOrder = await purchaseOrderModel.findById(purchaseOrderId);
        if (!purchaseOrder) {
            return reply.code(404).send({
                error: 'Purchase order not found'
            });
        }

        if (purchaseOrder.status !== 'approved' && purchaseOrder.status !== 'sent') {
            return reply.code(400).send({
                error: 'Can only create GRN for approved or sent purchase orders'
            });
        }

        // Calculate total PO quantity
        const poTotalQuantity = purchaseOrder.items.reduce((sum, item) => sum + item.quantity, 0);

        // Check if quantity received doesn't exceed PO quantity
        if (quantityReceived > poTotalQuantity) {
            return reply.code(400).send({
                error: 'Quantity received cannot exceed purchase order quantity'
            });
        }

        // Get the Approval Workflow model
        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);
        
        // Find the GRN approval workflow for this facility
        const approvalWorkflow = await approvalWorkflowModel.findOne({ 
            module: 'purchase_orders', 
            facilityId 
        }).lean();
        
        if (!approvalWorkflow) {
            return reply.code(400).send({
                error: 'No approval workflow configured for goods received notes in this facility'
            });
        }

        // Format the approval steps from the workflow
        const workflowApprovals = approvalWorkflow.steps.map(step => ({
            stepNumber: step.stepNumber,
            stepName: step.name,
            approvers: step.approvers.map(approverId => ({
                userId: approverId.toString(),
                status: 'pending',
                actionDate: null,
                comments: ''
            }))
        }));

        // Process any uploaded files
        const files = [];
        if (request.files && request.files.length > 0) {
            for (const file of request.files) {
                const fileUrl = `uploads/${path.basename(file.path)}`;
                const fileName = file.originalname;
                const fileType = file.mimetype;

                files.push({
                    fileName,
                    fileType,
                    fileUrl
                });
            }
        }

        // Create the new goods received note document
        const newGoodsReceivedNote = {
            facilityId,
            poNumber,
            supplier: purchaseOrder.supplier,
            poId: purchaseOrderId,
            poQuantity: poTotalQuantity,
            quantityReceived: parseInt(quantityReceived),
            receivedBy,
            receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
            description: description || '',
            files,
            
            // Add approval workflow fields
            approvalWorkflowId: approvalWorkflow._id,
            approvalStatus: 'pending',
            currentStep: 1,
            approvals: workflowApprovals
        };

        const savedGoodsReceivedNote = await goodsReceivedNoteModel.create(newGoodsReceivedNote);

        // Populate the saved document for response
        const populatedGRN = await goodsReceivedNoteModel
            .findById(savedGoodsReceivedNote._id)
            .populate('supplier', 'name email contact')
            .populate('receivedBy', 'name email')
            .populate('poId', 'poNumber department items')
            .lean();

        return reply.code(200).send({
            message: 'Goods received note added successfully',
            data: populatedGRN
        });
    } catch (err) {
        console.error('Error in adding goods received note:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = add_goods_received_note;