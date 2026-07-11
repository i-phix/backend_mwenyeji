const payservedb = require("payservedb");
const { getModel } = require('../../../utils/getModel');

/**
 * Get combined invoices by customer
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Object} Combined invoices for a specific customer
 */
const getCustomerCombinedInvoices = async (request, reply) => {
  try {
    const { facilityId, customerId } = request.params;

    // Get the model for the specified facility
    const CombinedInvoiceModel = await getModel(
      "CombinedInvoice",
      payservedb.CombinedInvoice.schema,
      facilityId
    );

    // Find combined invoices for the customer
    const combinedInvoices = await CombinedInvoiceModel.find({
      "facility.id": facilityId,
      "customer.customerId": customerId,
    })
      .sort({ period: -1 })
      .lean();

    // Process invoices
    const processedInvoices = combinedInvoices.map((invoice) => ({
      ...invoice,
      customerInfo: {
        fullName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        customerId: invoice.customer.customerId,
        accountNumber: invoice.customer.accountNumber,
      },
      unitInfo: {
        unitId: invoice.unit.id,
        unitName: invoice.unit.name,
      },
      invoiceCount: invoice.invoices?.length || 0,
      calculatedBalance:
        invoice.totalAmount -
        (invoice.amountPaid || 0) +
        (invoice.totalBalanceBroughtForward || 0),
      invoiceTypes: invoice.invoices
        ? [...new Set(invoice.invoices.map((inv) => inv.type))]
        : [],
    }));

    return reply.code(200).send({
      success: true,
      data: processedInvoices,
      meta: {
        total: processedInvoices.length,
        customerId: customerId,
      },
    });
  } catch (error) {
    console.error(
      "Error occurred while fetching customer combined invoices:",
      error.message
    );
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = getCustomerCombinedInvoices;