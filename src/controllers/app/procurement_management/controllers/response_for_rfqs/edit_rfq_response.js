const payservedb = require('payservedb');
const path = require('path');
const mongoose = require('mongoose');

const edit_rfq_response = async (request, reply) => {
    try {
        const { responseId } = request.params;
        const { supplierId, items, notes } = request.body;

        // Validate required fields
        if (!responseId || !supplierId || !items) {
            return reply.code(400).send({
                success: false,
                error: 'Response ID, Supplier ID, and items are required'
            });
        }

        // Find the RFQ response
        const rfqResponse = await payservedb.RFQResponse.findById(responseId);
        if (!rfqResponse) {
            return reply.code(404).send({
                success: false,
                error: 'RFQ response not found'
            });
        }

        // Find the RFQ details to check closing date
        const rfqDetails = await payservedb.RFQDetails.findById(rfqResponse.rfqId);
        if (!rfqDetails) {
            return reply.code(404).send({
                success: false,
                error: 'RFQ details not found'
            });
        }

        // Check if RFQ is still open
        const currentDate = new Date();
        if (currentDate > new Date(rfqDetails.closingDate)) {
            return reply.code(400).send({
                success: false,
                error: 'This RFQ is closed for submissions'
            });
        }

        // Check if response is already awarded
        if (rfqResponse.status === 'awarded') {
            return reply.code(400).send({
                success: false,
                error: 'Cannot edit responses for awarded RFQs'
            });
        }

        // Find the supplier in the response
        const supplierIndex = rfqResponse.suppliers.findIndex(
            s => s.supplierId.toString() === supplierId
        );

        if (supplierIndex === -1) {
            return reply.code(404).send({
                success: false,
                error: 'Supplier not found in this RFQ response'
            });
        }

        // Process any uploaded documents
        const attachments = [...(rfqResponse.suppliers[supplierIndex].quotationDetails?.attachments || [])];
        
        if (request.files && request.files.length > 0) {
            for (const file of request.files) {
                const filePath = `uploads/${path.basename(file.path)}`;
                const fileName = request.body[`fileName_${file.fieldname.split('_')[1]}`] || file.originalname;
                const fileType = file.mimetype || 'application/octet-stream';
                
                attachments.push({
                    name: fileName,
                    fileType: fileType,
                    filePath: filePath,
                    uploadDate: new Date()
                });
            }
        }

        // Calculate totals
        let totalAmount = 0;
        const quotationItems = [];

        for (const item of items) {
            const unitPrice = parseFloat(item.unitPrice);
            const quantity = parseInt(item.quantity);
            const totalPrice = unitPrice * quantity;
            
            totalAmount += totalPrice;
            
            quotationItems.push({
                categoryId: item.categoryId,
                itemId: item.itemId,
                unitPrice: unitPrice,
                quantity: quantity,
                totalPrice: totalPrice,
                notes: item.notes || ''
            });
        }

        // Update the supplier's response
        rfqResponse.suppliers[supplierIndex].responseDate = new Date();
        rfqResponse.suppliers[supplierIndex].quotationSubmitted = true;
        rfqResponse.suppliers[supplierIndex].quotationDetails = {
            submissionDate: new Date(),
            totalAmount: totalAmount,
            items: quotationItems,
            attachments: attachments,
            notes: notes || rfqResponse.suppliers[supplierIndex].quotationDetails?.notes || ''
        };

        // Save the updated response
        await rfqResponse.save();

        return reply.code(200).send({
            success: true,
            message: 'RFQ response updated successfully',
            data: rfqResponse
        });
    } catch (err) {
        console.error('Error in editing RFQ response:', err);
        return reply.code(400).send({
            success: false,
            error: err.message || 'An error occurred while updating the RFQ response'
        });
    }
};

module.exports = edit_rfq_response;