const payservedb = require("payservedb");
const invoiceGenerator = require("../utils/invoiceGenerator");

const cancelFacilityInvoicePayment = async (request, reply) => {
  try {
    // Extract IDs from URL parameters
    const { facilityId, invoiceId, paymentId } = request.params;

    // Extract rejection reason from request body
    const { rejectedReason } = request.body;

    // Validate required fields
    if (!rejectedReason || rejectedReason.trim() === "") {
      return reply.code(400).send({
        error: "Rejection reason is required",
      });
    }

    // Check if facility exists
    const facility = await payservedb.Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({
        error: "Facility not found",
      });
    }

    // Check if invoice exists
    const invoice = await payservedb.FacilityInvoice.findById(invoiceId);
    if (!invoice) {
      return reply.code(404).send({
        error: "Invoice not found",
      });
    }

    // Verify invoice belongs to the facility
    if (invoice.facilityId.toString() !== facilityId.toString()) {
      return reply.code(400).send({
        error: "Invoice does not belong to the specified facility",
      });
    }

    // Check if payment exists
    const payment = await payservedb.FacilityInvoicePayment.findById(paymentId);
    if (!payment) {
      return reply.code(404).send({
        error: "Payment not found",
      });
    }

    // Verify payment belongs to the invoice
    if (payment.invoiceId.toString() !== invoiceId.toString()) {
      return reply.code(400).send({
        error: "Payment does not belong to the specified invoice",
      });
    }

    // Check if payment is already rejected
    if (payment.status === "rejected") {
      return reply.code(400).send({
        error: "Payment is already rejected",
      });
    }

    // Update payment to rejected status
    payment.status = "rejected";
    payment.rejectedReason = rejectedReason;
    await payment.save();

    // Get all non-rejected payments for this invoice to recalculate status
    const validPayments = await payservedb.FacilityInvoicePayment.find({
      invoiceId,
      status: { $in: ["pending", "paid", "overpaid"] }, // Exclude rejected
    });

    // Calculate total amount paid (excluding rejected payments)
    const totalPaid = validPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    // Determine new invoice status based on remaining payments
    let newInvoiceStatus = "pending";
    if (totalPaid === 0) {
      newInvoiceStatus = "pending"; // No valid payments
    } else if (totalPaid >= invoice.amount) {
      newInvoiceStatus = "paid"; // Fully paid
    } else {
      newInvoiceStatus = "pending"; // Partially paid
    }

    // Update invoice status
    await payservedb.FacilityInvoice.findByIdAndUpdate(invoiceId, {
      status: newInvoiceStatus,
      updatedAt: new Date(),
    });

    // Recalculate payment statuses for remaining valid payments
    for (const validPayment of validPayments) {
      let updatedStatus = "pending";
      if (totalPaid > invoice.amount) {
        updatedStatus = "overpaid";
      } else if (totalPaid === invoice.amount) {
        updatedStatus = "paid";
      }

      if (validPayment.status !== updatedStatus) {
        await payservedb.FacilityInvoicePayment.findByIdAndUpdate(
          validPayment._id,
          { status: updatedStatus },
        );
      }
    }

    // Fetch updated invoice for response
    const updatedInvoice = await payservedb.FacilityInvoice.findById(invoiceId);

    // Recalculate balance brought forward for all invoices after this one
    console.log(
      `[Payment Cancelled] Triggering balance recalculation for invoices after ${invoice.invoiceDate}`,
    );
    const recalcResult = await invoiceGenerator.recalculateBalancesAfterDate(
      facilityId,
      invoice.recipient.email,
      new Date(invoice.invoiceDate.getTime() + 1), // Start from next day to exclude current invoice
    );
    console.log(
      `[Payment Cancelled] Recalculation complete: ${recalcResult.updated} invoice(s) updated`,
    );

    return reply.code(200).send({
      message: "Payment cancelled successfully",
      payment: {
        id: payment._id,
        status: payment.status,
        rejectedReason: payment.rejectedReason,
        amountPaid: payment.amountPaid,
      },
      paymentSummary: {
        invoiceAmount: invoice.amount,
        totalPaid: totalPaid,
        remainingBalance: Math.max(0, invoice.amount - totalPaid),
        overpaidAmount: Math.max(0, totalPaid - invoice.amount),
        invoiceStatus: newInvoiceStatus,
        activePaymentsCount: validPayments.length,
      },
      invoice: {
        id: updatedInvoice._id,
        status: updatedInvoice.status,
        amount: updatedInvoice.amount,
      },
      balanceRecalculation: {
        affectedInvoices: recalcResult.updated,
        details: recalcResult.invoices || [],
      },
    });
  } catch (error) {
    console.error("Error cancelling facility invoice payment:", error);
    return reply.code(500).send({
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = cancelFacilityInvoicePayment;
