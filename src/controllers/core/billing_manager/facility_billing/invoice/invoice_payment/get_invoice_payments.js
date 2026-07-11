const payservedb = require("payservedb");

const getInvoicePayments = async (request, reply) => {
  try {
    // Extract IDs from URL parameters
    const { facilityId, invoiceId } = request.params;

    // Optional query parameters for filtering
    const { status, page = 1, limit = 10 } = request.query;

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

    // Build query filter
    const filter = { invoiceId };
    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const totalPayments = await payservedb.FacilityInvoicePayment.countDocuments(
      filter,
    );

    // Fetch payments with pagination
    const payments = await payservedb.FacilityInvoicePayment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate payment summary (only non-rejected payments)
    const validPayments = await payservedb.FacilityInvoicePayment.find({
      invoiceId,
      status: { $in: ["pending", "paid", "overpaid"] },
    });

    const totalPaid = validPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remainingBalance = Math.max(0, invoice.amount - totalPaid);
    const overpaidAmount = Math.max(0, totalPaid - invoice.amount);

    // Group payments by status
    const paymentsByStatus = await payservedb.FacilityInvoicePayment.aggregate([
      { $match: { invoiceId: invoice._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amountPaid" },
        },
      },
    ]);

    return reply.code(200).send({
      success: true,
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
      },
      paymentSummary: {
        invoiceAmount: invoice.amount,
        totalPaid: totalPaid,
        remainingBalance: remainingBalance,
        overpaidAmount: overpaidAmount,
        validPaymentsCount: validPayments.length,
        totalPaymentsCount: totalPayments,
      },
      paymentsByStatus: paymentsByStatus.reduce((acc, item) => {
        acc[item._id] = {
          count: item.count,
          totalAmount: item.totalAmount,
        };
        return acc;
      }, {}),
      payments: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPayments / parseInt(limit)),
        totalRecords: totalPayments,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching invoice payments:", error);
    return reply.code(500).send({
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = getInvoicePayments;
