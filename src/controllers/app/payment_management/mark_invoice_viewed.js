const mongoose = require("mongoose");
const { getModel } = require("../../../utils/getModel");
const payservedb = require("payservedb");

/**
 * Marks an invoice as viewed when the invoice page is opened
 * 
 * This updates the viewStatus field with details about who viewed it and when
 * 
 * @param {Object} request - The request object containing facilityId and invoiceId
 * @param {Object} reply - The reply object for returning a response
 * @returns {Object} - Response indicating success or failure
 */
const mark_invoice_viewed = async (request, reply) => {
    console.log('=== Start: mark_invoice_viewed ===');
    console.log(`Request params: ${JSON.stringify(request.params)}`);
    console.log(`Request body: ${JSON.stringify(request.body)}`);

    try {
        const { invoiceId } = request.params;
        const { facilityId, userId, userRole } = request.body;

        if (!invoiceId || !facilityId) {
            console.log('Error: Missing required parameters');
            return reply.code(400).send({
                success: false,
                error: 'Invoice ID and Facility ID are required'
            });
        }

        // Determine invoice type based on prefix
        // we'll just use the standard Invoice model
        let invoiceModel;

        try {
            invoiceModel = await getModel(
                "Invoice",
                payservedb.Invoice.schema,
                facilityId
            );
            console.log('Using Invoice model');
        } catch (error) {
            console.error('Error getting invoice model:', error);
            return reply.code(500).send({
                success: false,
                error: 'Error accessing facility database'
            });
        }

        // Find the invoice
        const invoice = await invoiceModel.findById(invoiceId);
        if (!invoice) {
            console.log(`Error: Invoice not found with ID: ${invoiceId}`);
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found'
            });
        }

        console.log(`Found invoice: ${invoice.invoiceNumber}`);

        // Current timestamp for the view event
        const now = new Date();

        // Prepare the view history entry
        const viewHistoryEntry = {
            viewedAt: now,
            facilityId: facilityId,
            userId: userId || null
        };

        // Check if viewStatus exists and initialize if not
        if (!invoice.viewStatus) {
            invoice.viewStatus = {
                isOpened: true,
                openedAt: now,
                openedBy: {
                    facilityId: facilityId,
                    userId: userId || null,
                    userRole: userRole || 'facility_user'
                },
                viewHistory: [viewHistoryEntry]
            };
        } else {
            // If already viewed, just update the history
            if (!invoice.viewStatus.viewHistory) {
                invoice.viewStatus.viewHistory = [];
            }
            invoice.viewStatus.viewHistory.push(viewHistoryEntry);

            // If not already marked as opened, update that too
            if (!invoice.viewStatus.isOpened) {
                invoice.viewStatus.isOpened = true;
                invoice.viewStatus.openedAt = now;
                invoice.viewStatus.openedBy = {
                    facilityId: facilityId,
                    userId: userId || null,
                    userRole: userRole || 'facility_user'
                };
            }
        }

        // Save the updated invoice
        await invoice.save();
        console.log('Invoice marked as viewed successfully');

        return reply.code(200).send({
            success: true,
            message: 'Invoice marked as viewed successfully'
        });

    } catch (error) {
        console.error('Error marking invoice as viewed:', error);
        console.error('Error stack:', error.stack);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error marking invoice as viewed'
        });
    } finally {
        console.log('=== End: mark_invoice_viewed ===');
    }
};

module.exports = mark_invoice_viewed;