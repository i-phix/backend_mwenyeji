const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../../../utils/getModel');

const add_purchase_order = async (request, reply) => {
    try {
        const { facilityId } = request.params;
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
            userName
        } = request.body;

        // Basic validation
        if (!poNumber || !prNumber || !supplier || !department || !items || !items.length) {
            return reply.code(400).send({
                error: 'PO number, PR number, supplier, department, and at least one item are required'
            });
        }

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

        const purchaseOrderModel = await getModel('PurchaseOrder', payservedb.PurchaseOrder.schema, facilityId);

        // Check if purchase order with this PO number already exists
        const existingOrder = await purchaseOrderModel.findOne({ poNumber });
        if (existingOrder) {
            return reply.code(400).send({
                error: 'A purchase order with this PO number already exists'
            });
        }

        // Get the Approval Workflow model
        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);
        
        // Find the purchase order approval workflow for this facility
        const approvalWorkflow = await approvalWorkflowModel.findOne({ 
            module: 'purchase_orders', 
            facilityId 
        }).lean();
        
        if (!approvalWorkflow) {
            return reply.code(400).send({
                error: 'No approval workflow configured for purchase orders in this facility'
            });
        }

        // Format the approval steps from the workflow
        // Store user IDs as strings to avoid User model dependency
        const workflowApprovals = approvalWorkflow.steps.map(step => ({
            stepNumber: step.stepNumber,
            stepName: step.name,
            approvers: step.approvers.map(approverId => ({
                userId: approverId.toString(), // Convert ObjectId to string
                status: 'pending',
                actionDate: null,
                comments: ''
            }))
        }));

        // Process any uploaded attachments
        const attachments = [];
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

        // Calculate initial totals
        const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const taxTotal = items.reduce((sum, item) => {
            const itemTax = (item.unitPrice * item.quantity) * ((item.taxRate || 0) / 100);
            return sum + itemTax;
        }, 0);
        const grandTotal = subtotal + taxTotal;

        // Create the new purchase order document
        const newPurchaseOrder = {
            facilityId,
            poNumber,
            prNumber,
            supplier,
            department,
            currency: currency || 'KES',
            date: date || new Date(),
            internalNotes: internalNotes || '',
            supplierNotes: supplierNotes || '',
            budget: budget || '',
            status: 'pending',
            items,
            subtotal,
            taxTotal,
            grandTotal,
            approvers: approvers || [],
            attachments,
            from: userName || '',
            
            // Add approval workflow fields
            approvalWorkflowId: approvalWorkflow._id,
            approvalStatus: 'pending',
            currentStep: 1,
            approvals: workflowApprovals
        };

        const savedPurchaseOrder = await purchaseOrderModel.create(newPurchaseOrder);

        return reply.code(200).send({
            message: 'Purchase order added successfully',
            data: savedPurchaseOrder
        });
    } catch (err) {
        console.error('Error in adding purchase order:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = add_purchase_order;