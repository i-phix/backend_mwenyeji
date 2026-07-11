const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const getUnpaidInvoicesForUnit = async (request, reply) => {
  try {
    // Extract parameters from request
    const { facilityId } = request.params;
    const { unitId, customerId } = request.query;

    //console.log(`Fetching unpaid invoices for facilityId=${facilityId}, unitId=${unitId}, customerId=${customerId}`);

    if (!facilityId || !unitId || !customerId) {
      return reply.code(400).send({
        success: false,
        message: "Missing required parameters",
        data: [] // Always include empty array in case of error
      });
    }

    // Get the Invoice model
    const invoiceModel = await getModel("Invoice", payservedb.Invoice.schema, facilityId);
    if (!invoiceModel) {
      return reply.code(500).send({
        success: false,
        message: "Failed to get Invoice model for facility",
        data: [] // Always include empty array in case of error
      });
    }

    // Find all unpaid/overdue/partially paid invoices for this unit and customer
    const unpaidInvoices = await invoiceModel.find({
      "unit.id": unitId,
      "client.clientId": customerId,
      "status": { $in: ["Unpaid", "Overdue", "Partially Paid"] }
    })
    .select({
      _id: 1,
      invoiceNumber: 1,
      unit: 1,
      totalAmount: 1,
      amountPaid: 1,
      issueDate: 1,
      dueDate: 1,
      status: 1,
      whatFor: 1,
      items: 1,
      currency: 1,
      balanceBroughtForward: 1
    })
    .lean();

    //console.log(`Found ${unpaidInvoices ? unpaidInvoices.length : 0} unpaid invoices`);

    // Handle null or undefined results
    if (!unpaidInvoices) {
      return reply.code(200).send({
        success: true,
        message: "No unpaid invoices found or query error",
        data: [] // Return empty array instead of null
      });
    }

    // Calculate the remaining amount on each invoice
    const invoicesWithBalance = unpaidInvoices.map(invoice => {
      // Calculate remaining balance
      const balance = invoice.totalAmount - (invoice.amountPaid || 0) + (invoice.balanceBroughtForward > 0 ? invoice.balanceBroughtForward : 0);
      
      // Add default currency if missing
      if (!invoice.currency) {
        invoice.currency = {
          code: 'USD',
          name: 'US Dollar'
        };
      }

      return {
        ...invoice,
        balance,
        // Create a summary of invoice items for display, with null check
        itemsSummary: Array.isArray(invoice.items) && invoice.items.length > 0 
          ? invoice.items.map(item => item.description || '').join(', ')
          : "No items",
        // Format invoice type for display
        formattedType: invoice.whatFor?.invoiceType || "Unknown Type",
        formattedDate: new Date(invoice.issueDate || Date.now()).toLocaleDateString(),
        formattedDueDate: new Date(invoice.dueDate || Date.now()).toLocaleDateString()
      };
    });

    // Only return invoices with a positive balance
    const invoicesWithPositiveBalance = invoicesWithBalance.filter(invoice => invoice.balance > 0);

    // Direct return pattern - send the array directly in the data property
    return reply.code(200).send({
      success: true,
      message: `Retrieved ${invoicesWithPositiveBalance.length} unpaid invoices`,
      data: invoicesWithPositiveBalance // This should be a direct array, not nested
    });
  } catch (error) {
    //console.error("Error occurred while fetching unpaid invoices:", error);
    return reply.code(500).send({
      success: false,
      message: error.message || "An error occurred while fetching unpaid invoices",
      data: [] // Always include empty array in case of error
    });
  }
};

module.exports = getUnpaidInvoicesForUnit