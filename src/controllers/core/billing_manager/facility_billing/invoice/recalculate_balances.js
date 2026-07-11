const payservedb = require("payservedb");
const invoiceGenerator = require("./utils/invoiceGenerator");

const recalculateBalances = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { recipientEmail, fromDate } = request.body;

    // Validate facility exists
    const facility = await payservedb.Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({
        success: false,
        error: "Facility not found",
      });
    }

    // Determine start date for recalculation
    let startDate;
    if (fromDate) {
      startDate = new Date(fromDate);
      if (isNaN(startDate.getTime())) {
        return reply.code(400).send({
          success: false,
          error: "Invalid date format. Use ISO format (e.g., 2025-01-01)",
        });
      }
    } else {
      // Default: recalculate from the earliest invoice
      startDate = new Date(0); // Beginning of time
    }

    console.log(
      `[Manual Recalculation] Starting for facility ${facility.name} (${facilityId})`,
    );

    // Get all unique recipients for this facility
    const allInvoices = await payservedb.FacilityInvoice.find({ facilityId });
    const uniqueRecipients = [
      ...new Set(allInvoices.map((inv) => inv.recipient.email)),
    ];

    console.log(
      `[Manual Recalculation] Found ${uniqueRecipients.length} unique recipient(s)`,
    );

    // Filter by specific recipient if provided
    const recipientsToProcess = recipientEmail
      ? uniqueRecipients.filter((email) => email === recipientEmail)
      : uniqueRecipients;

    if (recipientsToProcess.length === 0) {
      return reply.code(404).send({
        success: false,
        error: recipientEmail
          ? "No invoices found for the specified recipient"
          : "No invoices found for this facility",
      });
    }

    const results = [];
    let totalUpdated = 0;

    // Recalculate for each recipient
    for (const email of recipientsToProcess) {
      console.log(
        `[Manual Recalculation] Processing recipient: ${email}`,
      );

      const recalcResult = await invoiceGenerator.recalculateBalancesAfterDate(
        facilityId,
        email,
        startDate,
      );

      results.push({
        recipientEmail: email,
        updated: recalcResult.updated,
        invoices: recalcResult.invoices,
        error: recalcResult.error || null,
      });

      totalUpdated += recalcResult.updated;
    }

    console.log(
      `[Manual Recalculation] Completed. Total invoices updated: ${totalUpdated}`,
    );

    return reply.code(200).send({
      success: true,
      message: `Successfully recalculated balances for ${recipientsToProcess.length} recipient(s)`,
      facility: {
        id: facility._id,
        name: facility.name,
      },
      summary: {
        recipientsProcessed: recipientsToProcess.length,
        totalInvoicesUpdated: totalUpdated,
        startDate: startDate.toISOString(),
      },
      results: results,
    });
  } catch (error) {
    console.error("Error recalculating balances:", error);
    return reply.code(500).send({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = recalculateBalances;
