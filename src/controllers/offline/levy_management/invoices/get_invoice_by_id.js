const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");

const GetInvoice = async (request, reply) => {
  try {
    const { facilityId, invoiceId } = request.params;

    if (!facilityId || !invoiceId) {
      return reply.code(400).send({
        success: false,
        message: "Facility ID and Invoice ID are required"
      });
    }

    const invoiceModel = await getModel(
      "Invoice",
      payservedb.Invoice.schema,
      facilityId
    );

    const invoice = await invoiceModel.findOne({ _id: invoiceId }).lean();

    if (!invoice) {
      return reply.code(404).send({
        success: false,
        message: "Invoice not found."
      });
    }

    // Format the invoice with client info and calculated balance
    const formattedInvoice = {
      ...invoice,
      calculatedBalance: invoice.totalAmount - (invoice.amountPaid || 0),
      customerInfo: {
        fullName: `${invoice.client.firstName} ${invoice.client.lastName}`,
        clientId: invoice.client.clientId,
        firstName: invoice.client.firstName,
        lastName: invoice.client.lastName
      }
    };

    return reply.code(200).send({
      success: true,
      message: "Invoice retrieved successfully",
      data: formattedInvoice
    });
  } catch (err) {
    console.error("Error in retrieving invoice:", err);
    return reply.code(500).send({
      success: false,
      message: err.message
    });
  }
};

module.exports = GetInvoice;