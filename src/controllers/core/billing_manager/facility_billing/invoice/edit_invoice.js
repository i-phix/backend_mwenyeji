const payservedb = require("payservedb");

const editInvoice = async (request, reply) => {
    try {
        const { facilityId, invoiceId } = request.params;
        const {
            dueDate,
            status,
            items,
            taxRate,
            reminders,
            header,
            footer
        } = request.body;

        // Find the invoice
        const invoice = await payservedb.FacilityInvoice.findOne({
            _id: invoiceId,
            facilityId
        });

        if (!invoice) {
            return reply.code(404).send({
                error: "Invoice not found"
            });
        }

        // Check if invoice can be edited (only pending and overdue invoices can be edited)
        if (invoice.status === 'paid') {
            return reply.code(400).send({
                error: "Cannot edit a paid invoice"
            });
        }

        // Prepare update data
        const updateData = {};

        if (dueDate) {
            updateData.dueDate = new Date(dueDate);
        }

        if (status && ['pending', 'paid', 'overdue'].includes(status)) {
            updateData.status = status;
        }

        if (items && Array.isArray(items)) {
            // Recalculate totals if items are updated
            const amount = items.reduce((total, item) => total + (item.amount || 0), 0);
            const currentTaxRate = taxRate !== undefined ? taxRate : invoice.taxRate;
            const taxAmount = (amount * currentTaxRate) / 100;
            const totalAmount = amount + taxAmount;

            updateData.items = items;
            updateData.amount = totalAmount;
            updateData.taxRate = currentTaxRate;
        } else if (taxRate !== undefined && taxRate !== invoice.taxRate) {
            // Recalculate if only tax rate changes
            const currentAmount = invoice.items.reduce((total, item) => total + item.amount, 0);
            const taxAmount = (currentAmount * taxRate) / 100;
            const totalAmount = currentAmount + taxAmount;

            updateData.taxRate = taxRate;
            updateData.amount = totalAmount;
        }

        if (reminders && Array.isArray(reminders)) {
            updateData.reminders = reminders;
        }

        if (header) {
            updateData.header = { ...invoice.header, ...header };
        }

        if (footer) {
            updateData.footer = { ...invoice.footer, ...footer };
        }

        // Update the invoice
        const updatedInvoice = await payservedb.FacilityInvoice.findByIdAndUpdate(
            invoiceId,
            updateData,
            { new: true, runValidators: true }
        );

        return reply.code(200).send({
            success: true,
            message: "Invoice updated successfully",
            invoice: updatedInvoice
        });

    } catch (err) {
        console.error("Error editing invoice:", err);
        return reply.code(500).send({ 
            error: "Failed to update invoice",
            details: err.message 
        });
    }
};

module.exports = editInvoice;