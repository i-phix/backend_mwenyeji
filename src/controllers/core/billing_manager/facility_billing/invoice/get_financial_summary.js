const payservedb = require("payservedb");

const getFinancialSummary = async (request, reply) => {
  try {
    const { companyId, facilityId, startDate, endDate } = request.query;

    console.log(
      `[Financial Summary] Fetching summary - Facility: ${facilityId || "All"}, Date Range: ${startDate || "All"} to ${endDate || "Now"}`,
    );

    // Build filter for invoices
    const invoiceFilter = {};
    if (facilityId) {
      invoiceFilter.facilityId = facilityId;
    }
    if (startDate || endDate) {
      invoiceFilter.invoiceDate = {};
      if (startDate) invoiceFilter.invoiceDate.$gte = new Date(startDate);
      if (endDate) invoiceFilter.invoiceDate.$lte = new Date(endDate);
    }

    // Get all invoices matching filter
    const invoices = await payservedb.FacilityInvoice.find(invoiceFilter);

    console.log(`[Financial Summary] Found ${invoices.length} invoice(s)`);

    // Calculate expected cash (total of all invoice amounts)
    const expectedCash = invoices.reduce(
      (sum, inv) => sum + (inv.amount || 0),
      0,
    );

    // Get all payments for these invoices
    const invoiceIds = invoices.map((inv) => inv._id);
    const payments = await payservedb.FacilityInvoicePayment.find({
      invoiceId: { $in: invoiceIds },
      status: { $in: ["pending", "paid", "overpaid"] }, // Exclude rejected payments
    });

    console.log(`[Financial Summary] Found ${payments.length} payment(s)`);

    // Calculate paid cash (total of all payment amounts)
    const paidCash = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    // Calculate outstanding (what's still owed)
    const outstanding = expectedCash - paidCash;

    // Calculate collection rate percentage
    const collectionRate =
      expectedCash > 0 ? ((paidCash / expectedCash) * 100).toFixed(2) : 0;

    // Group invoices by status
    const byStatus = {
      pending: { count: 0, amount: 0 },
      partially_paid: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
    };

    invoices.forEach((inv) => {
      const status = inv.status || "pending";
      if (byStatus[status]) {
        byStatus[status].count++;
        byStatus[status].amount += inv.amount || 0;
      }
    });

    // Group payments by method
    const paymentMethods = {};
    payments.forEach((p) => {
      const method = p.paymentMethod || "cash";
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, amount: 0 };
      }
      paymentMethods[method].count++;
      paymentMethods[method].amount += p.amountPaid || 0;
    });

    // Monthly breakdown (last 6 months)
    const now = new Date();
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
      );

      const monthInvoices = invoices.filter((inv) => {
        const invDate = new Date(inv.invoiceDate);
        return invDate >= monthStart && invDate <= monthEnd;
      });

      const monthInvoiceIds = monthInvoices.map((inv) => inv._id.toString());
      const monthPayments = payments.filter((p) =>
        monthInvoiceIds.includes(p.invoiceId.toString()),
      );

      const monthExpected = monthInvoices.reduce(
        (sum, inv) => sum + (inv.amount || 0),
        0,
      );
      const monthPaid = monthPayments.reduce(
        (sum, p) => sum + (p.amountPaid || 0),
        0,
      );

      monthlyData.push({
        month: monthStart.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
        expected: monthExpected,
        paid: monthPaid,
        outstanding: monthExpected - monthPaid,
        invoiceCount: monthInvoices.length,
        paymentCount: monthPayments.length,
      });
    }

    console.log(
      `[Financial Summary] Expected: ${expectedCash}, Paid: ${paidCash}, Outstanding: ${outstanding}, Collection Rate: ${collectionRate}%`,
    );

    return reply.code(200).send({
      success: true,
      summary: {
        expectedCash: expectedCash,
        paidCash: paidCash,
        outstanding: outstanding,
        collectionRate: parseFloat(collectionRate),
        totalInvoices: invoices.length,
        totalPayments: payments.length,
      },
      breakdown: {
        byStatus: byStatus,
        byPaymentMethod: paymentMethods,
      },
      monthlyTrend: monthlyData,
      period: {
        startDate: startDate || "All time",
        endDate: endDate || "Current",
        facilityId: facilityId || "All facilities",
      },
    });
  } catch (error) {
    console.error("[Financial Summary] Error:", error);
    return reply.code(500).send({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = getFinancialSummary;
