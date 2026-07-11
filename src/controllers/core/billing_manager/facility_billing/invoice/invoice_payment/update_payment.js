const payservedb = require("payservedb");
const invoiceGenerator = require("../utils/invoiceGenerator");

const updateFacilityInvoicePayment = async (request, reply) => {
  try {
    // Extract IDs from URL parameters
    const { facilityId, invoiceId, paymentId } = request.params;

    // Extract update fields from request body
    const {
      amountPaid,
      paymentDate,
      comments,
      paymentMethod,
      proofOfPaymentUrl,
    } = request.body;

    // Check if at least one field to update is provided
    if (
      amountPaid === undefined &&
      !paymentDate &&
      comments === undefined &&
      !paymentMethod &&
      proofOfPaymentUrl === undefined
    ) {
      return reply.code(400).send({
        error: "At least one field must be provided for update",
      });
    }

    // Validate amount if provided
    if (amountPaid !== undefined && amountPaid <= 0) {
      return reply.code(400).send({
        error: "Payment amount must be greater than 0",
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

    // Don't allow updating rejected payments
    if (payment.status === "rejected") {
      return reply.code(400).send({
        error: "Cannot update a rejected payment",
      });
    }

    // Store old amount for recalculation if needed
    const oldAmount = payment.amountPaid;
    const amountChanged = amountPaid !== undefined && amountPaid !== oldAmount;

    // Update payment fields
    if (amountPaid !== undefined) payment.amountPaid = amountPaid;
    if (paymentDate) payment.paymentDate = new Date(paymentDate);
    if (comments !== undefined) payment.comments = comments;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (proofOfPaymentUrl !== undefined)
      payment.proofOfPaymentUrl = proofOfPaymentUrl;

    // If amount changed, recalculate payment and invoice status
    if (amountChanged) {
      // Get all other valid payments for this invoice
      const otherPayments = await payservedb.FacilityInvoicePayment.find({
        invoiceId,
        _id: { $ne: paymentId },
        status: { $in: ["pending", "paid", "overpaid"] },
      });

      // Calculate new total
      const totalOtherPayments = otherPayments.reduce(
        (sum, p) => sum + p.amountPaid,
        0,
      );
      const newTotalPaid = totalOtherPayments + payment.amountPaid;

      // Determine new payment status
      let newPaymentStatus = "pending";
      let newInvoiceStatus = "pending";

      if (newTotalPaid > invoice.amount) {
        newPaymentStatus = "overpaid";
        newInvoiceStatus = "overpaid";
      } else if (newTotalPaid === invoice.amount) {
        newPaymentStatus = "paid";
        newInvoiceStatus = "paid";
      } else if (newTotalPaid > 0) {
        newPaymentStatus = "pending";
        newInvoiceStatus = "partially_paid"; // Has some payment but not fully paid
      } else if (newTotalPaid > 0) {
        newPaymentStatus = "pending";
        newInvoiceStatus = "partially_paid"; // Has some payment but not fully paid
      } else {
        newPaymentStatus = "pending";
        newInvoiceStatus = "pending"; // No payments
      }

      payment.status = newPaymentStatus;

      // Update invoice status
      await payservedb.FacilityInvoice.findByIdAndUpdate(invoiceId, {
        status: newInvoiceStatus,
        updatedAt: new Date(),
      });

      // Update status of other payments if needed
      if (newPaymentStatus === "overpaid") {
        await payservedb.FacilityInvoicePayment.updateMany(
          {
            invoiceId,
            _id: { $ne: paymentId },
            status: { $in: ["pending", "paid"] },
          },
          { status: "overpaid" },
        );
      } else if (
        newPaymentStatus === "paid" ||
        newPaymentStatus === "pending"
      ) {
        // Reset other overpaid payments if total is now within limits
        await payservedb.FacilityInvoicePayment.updateMany(
          {
            invoiceId,
            _id: { $ne: paymentId },
            status: "overpaid",
          },
          { status: newPaymentStatus },
        );
      }
    }

    await payment.save();

    // Recalculate balance brought forward for all invoices after this one if amount changed
    let recalcResult = { updated: 0, invoices: [] };
    if (amountChanged) {
      console.log(
        `[Payment Updated] Amount changed. Triggering balance recalculation for invoices after ${invoice.invoiceDate}`,
      );
      recalcResult = await invoiceGenerator.recalculateBalancesAfterDate(
        facilityId,
        invoice.recipient.email,
        new Date(invoice.invoiceDate.getTime() + 1), // Start from next day to exclude current invoice
      );
      console.log(
        `[Payment Updated] Recalculation complete: ${recalcResult.updated} invoice(s) updated`,
      );
    }

    // Calculate payment summary
    const allValidPayments = await payservedb.FacilityInvoicePayment.find({
      invoiceId,
      status: { $in: ["pending", "paid", "overpaid"] },
    });

    const totalPaid = allValidPayments.reduce(
      (sum, p) => sum + p.amountPaid,
      0,
    );

    // Fetch updated invoice
    const updatedInvoice = await payservedb.FacilityInvoice.findById(invoiceId);

    return reply.code(200).send({
      message: "Payment updated successfully",
      payment: payment,
      paymentSummary: {
        invoiceAmount: invoice.amount,
        totalPaid: totalPaid,
        remainingBalance: Math.max(0, invoice.amount - totalPaid),
        overpaidAmount: Math.max(0, totalPaid - invoice.amount),
        paymentStatus: payment.status,
        invoiceStatus: updatedInvoice.status,
      },
      changes: {
        amountChanged: amountChanged,
        oldAmount: amountChanged ? oldAmount : null,
        newAmount: amountChanged ? payment.amountPaid : null,
      },
      invoice: {
        id: updatedInvoice._id,
        status: updatedInvoice.status,
        amount: updatedInvoice.amount,
      },
      balanceRecalculation: {
        triggered: amountChanged,
        affectedInvoices: recalcResult.updated,
        details: recalcResult.invoices || [],
      },
    });
  } catch (error) {
    console.error("Error updating facility invoice payment:", error);
    return reply.code(500).send({
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = updateFacilityInvoicePayment;
