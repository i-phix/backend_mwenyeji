const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../../../utils/getModel');

const add_rfq = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.body.facilityId;
        
        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }
        
        const {
            name,
            startDate,
            closingDate,
            currency,
            rfqType,
            rfqFee,
            rfqEvaluationType,
            notes,
            category,
            suppliers,
            items,
            userName
        } = request.body;
        
        // Validate date range
        const startDateObj = new Date(startDate);
        const closingDateObj = new Date(closingDate);
        
        if (startDateObj >= closingDateObj) {
            return reply.code(400).send({
                success: false,
                error: 'Closing date must be after start date'
            });
        }

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return reply.code(400).send({
                success: false,
                error: 'At least one item must be added'
            });
        }

        // Validate each item
        for (const item of items) {
            if (!item.itemName || !item.quantity || !item.unitOfMeasure) {
                return reply.code(400).send({
                    success: false,
                    error: 'Each item must have a name, quantity, and unit of measure'
                });
            }
        }

        // Get the RFQ model using getModel
        const rfqModel = await getModel('RFQDetails', payservedb.RFQDetails.schema, facilityId);

        // Generate random RFQ number like RFQ-12345
        const rfqNumber = `RFQ-${Math.floor(10000 + Math.random() * 90000)}`;

        // Get the Approval Workflow model
        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);
        
        // Find the RFQ approval workflow for this facility
        const approvalWorkflow = await approvalWorkflowModel.findOne({ 
            module: 'quotation_approval', 
            facilityId 
        }).lean();
        
        if (!approvalWorkflow) {
            return reply.code(400).send({
                success: false,
                error: 'No approval workflow configured for RFQs in this facility'
            });
        }
        
        // Store user IDs as strings to avoid User model dependency
        const approvals = approvalWorkflow.steps.map(step => ({
            stepNumber: step.stepNumber,
            stepName: step.name,
            approvers: step.approvers.map(approverId => ({
                userId: approverId.toString(), 
                status: 'pending',
                actionDate: null,
                comments: ''
            }))
        }));

        // Create the new RFQ document
         const newRfq = new payservedb.RFQDetails({
            facilityId,
            name,
            rfqNumber,
            startDate: startDateObj,
            closingDate: closingDateObj,
            currency: currency || 'KES',
            rfqType: rfqType || 'closed',
            rfqFee: rfqFee || 0,
            rfqEvaluationType: rfqEvaluationType || 'automatic',
            notes: notes || '',
            category: category || '',
            suppliers: suppliers || [],
            items: items.map(item => ({
                itemName: item.itemName,
                description: item.description || '',
                quantity: item.quantity,
                unitOfMeasure: item.unitOfMeasure,
                specifications: item.specifications || '',
            })),
            status: 'Pending',
            from: userName || '',
            
            // Add approval workflow fields
            approvalWorkflowId: approvalWorkflow._id,
            approvalStatus: 'pending',
            currentStep: 1,
            approvals: approvals
        });

        // Save the RFQ using the model
         const savedRfq = await newRfq.save();

        return reply.code(200).send({
            success: true,
            message: 'Request for Quotation created successfully',
            data: savedRfq
        });
    } catch (err) {
        console.error('Error in creating RFQ:', err);
        return reply.code(400).send({
            success: false,
            error: err.message || 'An error occurred while creating the RFQ'
        });
    }
};

module.exports = add_rfq;