const payservedb = require("payservedb");
const { getModel } = require('../../../utils/getModel');

/**
 * Get a single combined invoice by ID
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Object} Single combined invoice
 */
const getCombinedInvoiceById = async (request, reply) => {
  try {
    const { facilityId, combinedInvoiceId } = request.params;

    // Get the model for the specified facility
    const CombinedInvoiceModel = await getModel(
      "CombinedInvoice",
      payservedb.CombinedInvoice.schema,
      facilityId
    );

    // Find the combined invoice
    const combinedInvoice = await CombinedInvoiceModel.findById(
      combinedInvoiceId
    ).lean();

    if (!combinedInvoice) {
      return reply.code(404).send({
        success: false,
        error: "Combined invoice not found",
      });
    }

    // Process invoice with additional computed fields
    const processedInvoice = {
      ...combinedInvoice,
      customerInfo: {
        fullName: `${combinedInvoice.customer.firstName} ${combinedInvoice.customer.lastName}`,
        customerId: combinedInvoice.customer.customerId,
        accountNumber: combinedInvoice.customer.accountNumber,
      },
      unitInfo: {
        unitId: combinedInvoice.unit.id,
        unitName: combinedInvoice.unit.name,
      },
      facilityInfo: {
        facilityId: combinedInvoice.facility.id,
        facilityName: combinedInvoice.facility.name,
      },
      invoiceCount: combinedInvoice.invoices?.length || 0,
      calculatedBalance:
        combinedInvoice.totalAmount -
        (combinedInvoice.amountPaid || 0) +
        (combinedInvoice.totalBalanceBroughtForward || 0),
      invoiceTypes: combinedInvoice.invoices
        ? [...new Set(combinedInvoice.invoices.map((inv) => inv.type))]
        : [],
    };

    return reply.code(200).send({
      success: true,
      data: processedInvoice,
    });
  } catch (error) {
    console.error(
      "Error occurred while fetching combined invoice:",
      error.message
    );
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = getCombinedInvoiceById;