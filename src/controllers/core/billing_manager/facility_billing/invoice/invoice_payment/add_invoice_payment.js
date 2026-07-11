const payservedb = require("payservedb");
const invoiceGenerator = require("../utils/invoiceGenerator");

const addFacilityInvoicePayment = async (request, reply) => {
  try {
    // Extract IDs from URL parameters
    const { facilityId, invoiceId } = request.params;

    // Extract other fields from request body
    const {
      paymentDate,
      amountPaid,
      comments,
      paymentMethod,
      rejectedReason,
      proofOfPaymentUrl, // New field for payment proof
    } = request.body;

    // Validate required fields
    if (!paymentDate || amountPaid == null) {
      return reply.code(400).send({
        error: "Missing required fields: paymentDate, amountPaid",
      });
    }

    // Validate payment amount
    if (amountPaid <= 0) {
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

    // Get all existing payments for this invoice
    const existingPayments = await payservedb.FacilityInvoicePayment.find({
      invoiceId,
      status: { $in: ["pending", "paid", "overpaid"] }, // Exclude rejected payments
    });

    // Calculate total amount already paid
    const totalPreviouslyPaid = existingPayments.reduce(
      (sum, payment) => sum + payment.amountPaid,
      0,
    );
    const totalAfterThisPayment = totalPreviouslyPaid + amountPaid;

    // Determine payment status based on amounts
    let paymentStatus = "pending";
    let newInvoiceStatus = invoice.status;

    if (totalAfterThisPayment > invoice.amount) {
      paymentStatus = "overpaid";
      newInvoiceStatus = "overpaid";
    } else if (totalAfterThisPayment === invoice.amount) {
      paymentStatus = "paid";
      newInvoiceStatus = "paid";
    } else {
      paymentStatus = "pending";
      newInvoiceStatus = "pending"; // Still has outstanding balance
    }

    // Create new payment record with proof of payment URL
    const newPayment = new payservedb.FacilityInvoicePayment({
      facilityId,
      invoiceId,
      paymentDate: new Date(paymentDate),
      amountPaid,
      comments: comments || "",
      status: paymentStatus,
      paymentMethod: paymentMethod || "cash",
      rejectedReason: rejectedReason || "",
      proofOfPaymentUrl: proofOfPaymentUrl || "", // Store the proof URL
    });

    await newPayment.save();

    // Update invoice status
    await payservedb.FacilityInvoice.findByIdAndUpdate(invoiceId, {
      status: newInvoiceStatus,
      updatedAt: new Date(),
    });

    // If overpaid, update all previous payments to reflect overpaid status
    if (paymentStatus === "overpaid") {
      await payservedb.FacilityInvoicePayment.updateMany(
        {
          invoiceId,
          status: { $in: ["pending", "paid"] },
        },
        { status: "overpaid" },
      );
    }

    // Fetch updated invoice for response
    const updatedInvoice = await payservedb.FacilityInvoice.findById(invoiceId);

    // Recalculate balance brought forward for all invoices after this one
    console.log(
      `[Payment Added] Triggering balance recalculation for invoices after ${invoice.invoiceDate}`,
    );
    const recalcResult = await invoiceGenerator.recalculateBalancesAfterDate(
      facilityId,
      invoice.recipient.email,
      new Date(invoice.invoiceDate.getTime() + 1), // Start from next day to exclude current invoice
    );
    console.log(
      `[Payment Added] Recalculation complete: ${recalcResult.updated} invoice(s) updated`,
    );

    return reply.code(201).send({
      message: "Payment added successfully",
      payment: newPayment,
      paymentSummary: {
        invoiceAmount: invoice.amount,
        totalPaid: totalAfterThisPayment,
        remainingBalance: Math.max(0, invoice.amount - totalAfterThisPayment),
        overpaidAmount: Math.max(0, totalAfterThisPayment - invoice.amount),
        paymentStatus: paymentStatus,
        invoiceStatus: newInvoiceStatus,
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
    console.error("Error adding facility invoice payment:", error);
    return reply.code(500).send({
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = addFacilityInvoicePayment;
