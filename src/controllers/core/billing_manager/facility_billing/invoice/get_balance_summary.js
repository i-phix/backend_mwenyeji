const payservedb = require("payservedb");

const getBalanceSummary = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { recipientEmail } = request.query;

    // Validate facility exists
    const facility = await payservedb.Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({
        success: false,
        error: "Facility not found",
      });
    }

    // Build query filter
    const invoiceFilter = { facilityId };
    if (recipientEmail) {
      invoiceFilter["recipient.email"] = recipientEmail;
    }

    // Get all invoices for this facility (and recipient if specified)
    const invoices = await payservedb.FacilityInvoice.find(invoiceFilter).sort({
      invoiceDate: 1,
    });

    if (invoices.length === 0) {
      return reply.code(200).send({
        success: true,
        message: "No invoices found for this facility",
        facility: {
          id: facility._id,
          name: facility.name,
        },
        totalBalanceBroughtForward: 0,
        invoices: [],
      });
    }

    // Calculate balance for each invoice
    const invoiceDetails = [];
    let runningBalance = 0;

    for (const invoice of invoices) {
      // Get all valid payments for this invoice
      const payments = await payservedb.FacilityInvoicePayment.find({
        invoiceId: invoice._id,
        status: { $in: ["pending", "paid", "overpaid"] }, // Exclude rejected
      });

      const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);

      // Calculate invoice balance
      const invoiceBalance = invoice.amount - totalPaid;

      // Update running balance
      const previousRunningBalance = runningBalance;
      runningBalance += invoiceBalance;

      // Determine payment status
      let paymentStatus = "unpaid";
      if (totalPaid === 0) {
        paymentStatus = "unpaid";
      } else if (totalPaid < invoice.amount) {
        paymentStatus = "partially_paid";
      } else if (totalPaid === invoice.amount) {
        paymentStatus = "fully_paid";
      } else if (totalPaid > invoice.amount) {
        paymentStatus = "overpaid";
      }

      invoiceDetails.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        recipient: {
          email: invoice.recipient.email,
          phoneNumber: invoice.recipient.phoneNumber,
        },
        amounts: {
          subtotal: invoice.subtotal || null,
          taxAmount: invoice.taxAmount || null,
          balanceBroughtForward: invoice.balanceBroughtForward || 0,
          totalAmount: invoice.amount,
        },
        payments: {
          count: payments.length,
          totalPaid: totalPaid,
          paymentStatus: paymentStatus,
          details: payments.map((p) => ({
            paymentId: p._id,
            date: p.paymentDate,
            amount: p.amountPaid,
            method: p.paymentMethod,
            status: p.status,
            proofOfPayment: p.proofOfPaymentUrl || null,
          })),
        },
        balance: {
          thisInvoice: invoiceBalance,
          runningTotal: runningBalance,
          previousRunningBalance: previousRunningBalance,
        },
        analysis: {
          isSettled: invoiceBalance === 0,
          hasOutstanding: invoiceBalance > 0,
          hasCredit: invoiceBalance < 0,
          outstandingAmount: Math.max(0, invoiceBalance),
          creditAmount: Math.abs(Math.min(0, invoiceBalance)),
        },
      });
    }

    // Calculate what would be brought forward to a new invoice
    const nextInvoiceBalance = runningBalance;

    return reply.code(200).send({
      success: true,
      facility: {
        id: facility._id,
        name: facility.name,
      },
      filter: {
        recipientEmail: recipientEmail || "all recipients",
      },
      summary: {
        totalInvoices: invoices.length,
        totalBalanceBroughtForward: nextInvoiceBalance,
        status:
          nextInvoiceBalance > 0
            ? "outstanding_debt"
            : nextInvoiceBalance < 0
              ? "credit_available"
              : "settled",
        statusDescription:
          nextInvoiceBalance > 0
            ? `Customer owes KES ${nextInvoiceBalance.toFixed(2)}`
            : nextInvoiceBalance < 0
              ? `Customer has credit of KES ${Math.abs(nextInvoiceBalance).toFixed(2)}`
              : "All invoices are settled",
        breakdown: {
          totalInvoiced: invoices.reduce((sum, inv) => sum + inv.amount, 0),
          totalPaid: invoiceDetails.reduce(
            (sum, inv) => sum + inv.payments.totalPaid,
            0,
          ),
          unpaidInvoices: invoiceDetails.filter(
            (inv) => inv.payments.paymentStatus === "unpaid",
          ).length,
          partiallyPaidInvoices: invoiceDetails.filter(
            (inv) => inv.payments.paymentStatus === "partially_paid",
          ).length,
          fullyPaidInvoices: invoiceDetails.filter(
            (inv) => inv.payments.paymentStatus === "fully_paid",
          ).length,
          overpaidInvoices: invoiceDetails.filter(
            (inv) => inv.payments.paymentStatus === "overpaid",
          ).length,
        },
      },
      invoices: invoiceDetails,
      nextInvoiceImpact: {
        balanceToBringForward: nextInvoiceBalance,
        willAddToInvoice: nextInvoiceBalance > 0,
        willReduceInvoice: nextInvoiceBalance < 0,
        description:
          nextInvoiceBalance > 0
            ? `The next invoice will have +KES ${nextInvoiceBalance.toFixed(2)} added (outstanding debt)`
            : nextInvoiceBalance < 0
              ? `The next invoice will be reduced by KES ${Math.abs(nextInvoiceBalance).toFixed(2)} (credit)`
              : "No balance adjustment for next invoice",
      },
    });
  } catch (error) {
    console.error("Error fetching balance summary:", error);
    return reply.code(500).send({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = getBalanceSummary;
