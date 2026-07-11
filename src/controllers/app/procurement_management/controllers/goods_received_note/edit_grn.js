const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../../../utils/getModel');

const edit_goods_received_note = async (request, reply) => {
    try {
        const { facilityId, grnId } = request.params;
        const {
            quantityReceived,
            receivedBy,
            receivedDate,
            description,
            notes
        } = request.body;

        const goodsReceivedNoteModel = await getModel('GoodsReceivedNote', payservedb.GoodsReceivedNote.schema, facilityId);

        // Find the existing GRN
        const existingGRN = await goodsReceivedNoteModel.findById(grnId);
        if (!existingGRN) {
            return reply.code(404).send({
                error: 'Goods received note not found'
            });
        }

        // Check if GRN can be edited (only if not yet approved)
        if (existingGRN.approvalStatus === 'approved') {
            return reply.code(400).send({
                error: 'Cannot edit an approved goods received note'
            });
        }

        // Validate quantity if provided
        if (quantityReceived !== undefined) {
            if (quantityReceived <= 0) {
                return reply.code(400).send({
                    error: 'Quantity received must be greater than 0'
                });
            }

            // Check if quantity doesn't exceed PO quantity
            if (quantityReceived > existingGRN.poQuantity) {
                return reply.code(400).send({
                    error: 'Quantity received cannot exceed purchase order quantity'
                });
            }
        }

        // Process any uploaded files
        let updatedFiles = [...existingGRN.files];
        if (request.files && request.files.length > 0) {
            for (const file of request.files) {
                const fileUrl = `uploads/${path.basename(file.path)}`;
                const fileName = file.originalname;
                const fileType = file.mimetype;

                updatedFiles.push({
                    fileName,
                    fileType,
                    fileUrl
                });
            }
        }

        // Prepare update object
        const updateData = {
            updatedAt: new Date()
        };

        // Update fields if provided
        if (quantityReceived !== undefined) {
            updateData.quantityReceived = parseInt(quantityReceived);
        }
        if (receivedBy !== undefined) {
            updateData.receivedBy = receivedBy;
        }
        if (receivedDate !== undefined) {
            updateData.receivedDate = new Date(receivedDate);
        }
        if (description !== undefined) {
            updateData.description = description;
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }
        if (request.files && request.files.length > 0) {
            updateData.files = updatedFiles;
        }

        // Reset approval status if substantial changes are made
        // (this might depend on your business logic)
        const substantialChange = quantityReceived !== undefined && 
                                quantityReceived !== existingGRN.quantityReceived;
        
        if (substantialChange && existingGRN.approvalStatus !== 'pending') {
            updateData.approvalStatus = 'pending';
            updateData.currentStep = 1;
            
            // Reset all approvals to pending
            updateData.approvals = existingGRN.approvals.map(step => ({
                ...step,
                approvers: step.approvers.map(approver => ({
                    ...approver,
                    status: 'pending',
                    actionDate: null,
                    comments: ''
                }))
            }));
        }

        // Update the GRN
        const updatedGRN = await goodsReceivedNoteModel.findByIdAndUpdate(
            grnId,
            updateData,
            { new: true, runValidators: true }
        );

        // Populate the updated document for response
        const populatedGRN = await goodsReceivedNoteModel
            .findById(updatedGRN._id)
            .populate('supplier', 'name email contact')
            .populate('receivedBy', 'name email')
            .populate('poId', 'poNumber department items grandTotal')
            .populate('approvals.approvers.userId', 'name email')
            .lean();

        return reply.code(200).send({
            message: 'Goods received note updated successfully',
            data: populatedGRN,
            resetApprovals: substantialChange && existingGRN.approvalStatus !== 'pending'
        });
    } catch (err) {
        console.error('Error in editing goods received note:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = edit_goods_received_note;