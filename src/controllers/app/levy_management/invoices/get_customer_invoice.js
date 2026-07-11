const mongoose = require("mongoose");
const { getModel } = require("../../../../utils/getModel");
const payservedb = require("payservedb");

const getCustomerInvoices = async (request, reply) => {
  try {
    const { facilityId, customerId } = request.params;

    if (!facilityId || !customerId) {
      return reply.code(400).send({
        success: false,
        message: "Facility ID and Customer ID are required"
      });
    }

    // Get the model for the specified facility
    const invoiceModel = await getModel(
      "Invoice",
      payservedb.Invoice.schema,
      facilityId
    );

    // Find all invoices for the specific customer using the new schema
    const customerInvoices = await invoiceModel.find({
      'client.clientId': customerId
    }).lean();

    if (!customerInvoices.length) {
      return reply.code(404).send({
        success: false,
        message: "No invoices found for this customer"
      });
    }

    // Process invoices to include calculated balance
    const processedInvoices = customerInvoices.map(invoice => ({
      ...invoice,
      calculatedBalance: invoice.totalAmount - (invoice.amountPaid || 0)
    }));

    return reply.code(200).send({
      success: true,
      data: processedInvoices
    });

  } catch (error) {
    console.error(
      "Error occurred while fetching customer invoices:",
      error.message
    );
    return reply.code(500).send({
      success: false,
      message: error.message
    });
  }
};

module.exports = getCustomerInvoices; 