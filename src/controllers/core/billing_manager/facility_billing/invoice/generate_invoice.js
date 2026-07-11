const payservedb = require("payservedb");
const invoiceGenerator = require("./utils/invoiceGenerator");

const generateInvoice = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { generateForAll, months } = request.body;

    // Validate months format if provided
    // Expected format: ["2024-01", "2024-02"] or "2024-01" for single month
    let monthsArray = [];
    if (months) {
      if (Array.isArray(months)) {
        monthsArray = months;
      } else if (typeof months === "string") {
        monthsArray = [months];
      } else {
        return reply.code(400).send({
          success: false,
          error:
            "Invalid months format. Use array like ['2024-01', '2024-02'] or string '2024-01'",
        });
      }

      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      for (const month of monthsArray) {
        if (!monthRegex.test(month)) {
          return reply.code(400).send({
            success: false,
            error: `Invalid month format: ${month}. Use YYYY-MM format (e.g., '2024-01')`,
          });
        }
      }

      console.log(
        "[Generate Invoice] Months received from frontend:",
        monthsArray,
      );
    }

    if (generateForAll) {
      // Generate invoices for all facilities
      const result = await invoiceGenerator.generateInvoices(monthsArray);

      return reply.code(200).send({
        success: true,
        message:
          monthsArray.length > 0
            ? `Invoice generation completed for all facilities for ${monthsArray.length} month(s)`
            : "Invoice generation completed for all facilities",
        result,
      });
    } else if (facilityId) {
      // Generate invoices for specific facility
      console.log(
        `[Generate Invoice] Generating for facility ${facilityId}, months:`,
        monthsArray,
      );
      const result = await invoiceGenerator.generateInvoicesForFacility(
        facilityId,
        monthsArray,
      );

      if (result.count === 0) {
        return reply.code(200).send({
          success: true,
          message:
            "No invoices generated - check if facility has recipients and active contracts",
          result,
        });
      }

      return reply.code(200).send({
        success: true,
        message:
          monthsArray.length > 0
            ? `Successfully generated ${result.count} invoice(s) for ${monthsArray.length} month(s)`
            : `Successfully generated ${result.count} invoice(s) for facility`,
        result,
      });
    } else {
      return reply.code(400).send({
        success: false,
        error:
          "Either provide facilityId in params or set generateForAll to true in body",
      });
    }
  } catch (err) {
    console.error("Error generating invoice:", err);
    return reply.code(500).send({
      success: false,
      error: "Failed to generate invoice",
      details: err.message,
    });
  }
};

module.exports = generateInvoice;
