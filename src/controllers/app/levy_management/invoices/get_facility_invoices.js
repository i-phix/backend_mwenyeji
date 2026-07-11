const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");

const getFacilityInvoices = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Get the model for the specified facility
    const invoiceModel = await getModel("Invoice", payservedb.Invoice.schema, facilityId);

    // Filter for only Levy invoices
    const invoices = await invoiceModel.find({
      "whatFor.invoiceType": "Contract"
    });

    const processedInvoices = invoices.map(invoice => ({
      ...invoice.toObject(),
      customerInfo: {
        fullName: `${invoice.client.firstName} ${invoice.client.lastName}`
      }
    }));

    return reply.code(200).send({
      success: true,
      data: processedInvoices
    });
  } catch (error) {
    console.error("Error occurred while fetching facility levy invoices:", error.message);
    return reply.code(500).send({
      success: false,
      error: error.message
    });
  }
};

module.exports = getFacilityInvoices;
