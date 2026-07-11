const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../../../utils/getModel');

const edit_purchase_order = async (request, reply) => {
    try {
        const { facilityId, purchaseOrderId } = request.params;
        const {
            poNumber,
            prNumber,
            supplier,
            department,
            currency,
            date,
            internalNotes,
            supplierNotes,
            budget,
            items,
            approvers,
            status
        } = request.body;

        // Basic validation
        if (!purchaseOrderId) {
            return reply.code(400).send({
                error: 'Purchase order ID is required'
            });
        }

        const purchaseOrderModel = await getModel('PurchaseOrder', payservedb.PurchaseOrder.schema, facilityId);

        // Check if purchase order exists
        const existingOrder = await purchaseOrderModel.findById(purchaseOrderId);
        if (!existingOrder) {
            return reply.code(404).send({
                error: 'Purchase order not found'
            });
        }

        // Check if PO number is being changed and if new one already exists
        if (poNumber && poNumber !== existingOrder.poNumber) {
            const duplicatePO = await purchaseOrderModel.findOne({
                poNumber,
                _id: { $ne: purchaseOrderId }
            });

            if (duplicatePO) {
                return reply.code(400).send({
                    error: 'Another purchase order with this PO number already exists'
                });
            }
        }

        // Process any new uploaded attachments
        let attachments = [...(existingOrder.attachments || [])];
        if (request.files && request.files.length > 0) {
            for (const file of request.files) {
                const filePath = `uploads/${path.basename(file.path)}`;
                const name = request.body[`attachmentName_${file.fieldname.split('_')[1]}`] || file.originalname;
                const fileType = file.mimetype;

                attachments.push({
                    name,
                    fileType,
                    filePath,
                    uploadDate: new Date()
                });
            }
        }

        // Handle attachment removals if specified
        const removedAttachments = request.body.removedAttachments ? 
            JSON.parse(request.body.removedAttachments) : [];
        
        if (removedAttachments.length > 0) {
            attachments = attachments.filter(attachment => 
                !removedAttachments.includes(attachment._id.toString()));
        }

        // Prepare the update data
        const updateData = {};
        
        // Update only the fields that were provided
        if (poNumber) updateData.poNumber = poNumber;
        if (prNumber) updateData.prNumber = prNumber;
        if (supplier) updateData.supplier = supplier;
        if (department) updateData.department = department;
        if (currency) updateData.currency = currency;
        if (date) updateData.date = date;
        if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
        if (supplierNotes !== undefined) updateData.supplierNotes = supplierNotes;
        if (budget !== undefined) updateData.budget = budget;
        if (status) updateData.status = status;
        
        // Update items if provided
        if (items && items.length > 0) {
            // Validate each item has required fields
            for (const item of items) {
                if (!item.itemDescription || !item.quantity || !item.unitOfMeasure || !item.unitPrice) {
                    return reply.code(400).send({
                        error: 'Each item must have description, quantity, unit of measure, and unit price'
                    });
                }
                // Calculate total price for the item if not provided
                if (!item.totalPrice) {
                    item.totalPrice = item.unitPrice * item.quantity * (1 + (item.taxRate || 0) / 100);
                }
            }
            
            updateData.items = items;
            
            // Recalculate totals
            updateData.subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
            updateData.taxTotal = items.reduce((sum, item) => {
                const itemTax = (item.unitPrice * item.quantity) * ((item.taxRate || 0) / 100);
                return sum + itemTax;
            }, 0);
            updateData.grandTotal = updateData.subtotal + updateData.taxTotal;
        }
        
        // Update approvers if provided
        if (approvers) updateData.approvers = approvers;
        
        // Update attachments
        updateData.attachments = attachments;

        const savedPurchaseOrder = await purchaseOrderModel.findByIdAndUpdate(
            purchaseOrderId,
            updateData,
            { new: true }
        );

        return reply.code(200).send({
            message: 'Purchase order updated successfully',
            data: savedPurchaseOrder
        });
    } catch (err) {
        console.error('Error in updating purchase order:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = edit_purchase_order;