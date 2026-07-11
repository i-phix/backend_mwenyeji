const payservedb = require("payservedb");

const getPayment = async (request, reply) => {
  try {
    // Extract IDs from URL parameters
    const { facilityId, invoiceId, paymentId } = request.params;

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

    // Calculate payment summary for context
    const allPayments = await payservedb.FacilityInvoicePayment.find({
      invoiceId,
      status: { $in: ["pending", "paid", "overpaid"] }, // Exclude rejected
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remainingBalance = Math.max(0, invoice.amount - totalPaid);

    return reply.code(200).send({
      success: true,
      payment: payment,
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
      },
      facility: {
        id: facility._id,
        name: facility.name,
      },
      context: {
        totalPaid: totalPaid,
        remainingBalance: remainingBalance,
        isFullyPaid: totalPaid >= invoice.amount,
        thisPaymentPercentage: ((payment.amountPaid / invoice.amount) * 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error fetching payment:", error);
    return reply.code(500).send({
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = getPayment;
