const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../../../utils/getModel');

// Controller: award an RFQ response and auto-create a Purchase Order
const award_rfq_response = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { rfqId, supplierId, prNumber, department, currency, date, internalNotes, supplierNotes, budget } = request.body;

    // Basic validation
    if (!rfqId || !supplierId || !department) {
      return reply.code(400).send({ error: 'rfqId, supplierId and department are required' });
    }

    // Load RFQ response
    const RFQResponse = payservedb.RFQResponse;
    const rfqResponse = await RFQResponse.findOne({ facilityId, rfqId, supplierId }).lean();
    if (!rfqResponse) {
      return reply.code(404).send({ error: 'RFQ response not found' });
    }
    if (rfqResponse.status === 'awarded') {
      return reply.code(400).send({ error: 'This response is already awarded' });
    }

    // Load RFQ details for unitOfMeasure lookup
    const RFQDetails = payservedb.RFQDetails;
    const rfqDetails = await RFQDetails.findOne({ _id: rfqId, facilityId }).lean();
    if (!rfqDetails) {
      return reply.code(404).send({ error: 'RFQ details not found' });
    }

    // Build PO items by merging response items with rfqDetails items
    const poItems = rfqResponse.items.map(respItem => {
      const orig = rfqDetails.items.find(i => i._id.toString() === respItem.itemId.toString());
      return {
        itemDescription: respItem.itemName || `Item ${respItem.itemId}`,
        quantity: respItem.quantity,
        unitOfMeasure: orig?.unitOfMeasure || 'Unit',
        unitPrice: respItem.unitPrice,
        taxRate: respItem.taxRate || 0,
        totalPrice: respItem.totalPrice
      };
    });

    // Calculate subtotal and grand total explicitly
    const subtotal = poItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const taxTotal = poItems.reduce((sum, item) => {
      const itemTax = (item.unitPrice * item.quantity) * (item.taxRate / 100);
      return sum + itemTax;
    }, 0);
    const grandTotal = subtotal + taxTotal;

    // Acquire PurchaseOrder model for this facility
    const purchaseOrderModel = await getModel('PurchaseOrder', payservedb.PurchaseOrder.schema, facilityId);

    // Auto-generate PO number: PO-00001 style
    const lastPO = await purchaseOrderModel.findOne({}).sort({ createdAt: -1 }).lean();
    let nextSeq = 1;
    if (lastPO && lastPO.poNumber) {
      const m = lastPO.poNumber.match(/PO-(\d+)/);
      if (m) nextSeq = parseInt(m[1], 10) + 1;
    }
    const poNumber = `PO-${String(nextSeq).padStart(5, '0')}`;

    // Find workflow
    const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);
    const approvalWorkflow = await approvalWorkflowModel.findOne({ module: 'purchase_orders', facilityId }).lean();
    if (!approvalWorkflow) {
      return reply.code(400).send({ error: 'No approval workflow configured for purchase orders' });
    }
    const workflowApprovals = approvalWorkflow.steps.map(step => ({
      stepNumber: step.stepNumber,
      stepName: step.name,
      approvers: step.approvers.map(id => ({ userId: id.toString(), status: 'pending', actionDate: null, comments: '' }))
    }));

    // Create PO object with correct status and calculated totals
    const newPO = {
      facilityId,
      poNumber,
      prNumber: prNumber || '',
      supplier: supplierId,
      department,
      currency: currency || rfqDetails.currency || 'KES',
      date: date ? new Date(date) : new Date(),
      internalNotes: internalNotes || rfqDetails.notes || '',
      supplierNotes: supplierNotes || rfqResponse.notes || '',
      budget: budget || '',
      status: 'pending approval',
      items: poItems,
      subtotal: subtotal,
      taxTotal: taxTotal,
      grandTotal: grandTotal,
      approvalWorkflowId: approvalWorkflow._id,
      approvalStatus: 'pending',
      currentStep: 1,
      approvals: workflowApprovals
    };

    // Save purchase order
    const savedPO = await purchaseOrderModel.create(newPO);

    // Update awarded RFQ response
    await RFQResponse.updateOne(
      { _id: rfqResponse._id },
      { status: 'awarded' }
    );

    // Decline all other RFQ responses for the same rfqId and facilityId
    await RFQResponse.updateMany(
      {
        rfqId,
        facilityId,
        _id: { $ne: rfqResponse._id }
      },
      { $set: { status: 'declined' } }
    );

    // If this PO is associated with a PR, update the PR's poStatus
    if (prNumber && prNumber.trim() !== '') {
      try {
        // Get the PurchaseRequest model for this facility
        const purchaseRequestModel = await getModel('PurchaseRequest', payservedb.PurchaseRequest.schema, facilityId);
        
        // Update the Purchase Request's poStatus to 'PO Raised'
        const updateResult = await purchaseRequestModel.updateOne(
          { facilityId, irfNumber: prNumber },
          { $set: { poStatus: 'PO Raised' } }
        );
        
        if (updateResult.matchedCount === 0) {
          console.warn(`No Purchase Request found with irfNumber: ${prNumber}`);
        } else {
          console.log(`Updated Purchase Request ${prNumber} poStatus to 'PO Raised'`);
        }
      } catch (prError) {
        // Log the error but don't fail the entire operation
        console.error('Error updating Purchase Request poStatus:', prError);
      }
    }

    return reply.code(200).send({
      message: 'RFQ response awarded and PO created',
      data: {
        response: rfqResponse._id,
        purchaseOrder: savedPO
      }
    });
  } catch (err) {
    console.error('Error in award_rfq_response:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = award_rfq_response;