const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_customer_invoices = async (request, reply) => {
  try {
    const { facilityId, customerId } = request.params; // Get customerId from params

    if (!facilityId || !customerId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID and Customer ID are required'
      });
    }

    // Get the models for the specific facility
    const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // Find invoices for the specific customer and facility
    const invoices = await invoiceModel.find({
      'facility.id': facilityId,
      'client.clientId': customerId, // Use customerId from params
      'whatFor.invoiceType': 'Lease' && 'Contract' // get both lease and contract invoices
    })
      .populate({
        path: 'client.clientId',
        model: payservedb.Customer,
        select: 'firstName lastName customerType'
      })
      .populate({
        path: 'unit.id',
        model: unitModel,
        select: 'name tenantId'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Process invoices with additional information
    const invoicesWithCustomerInfo = invoices.map(invoice => {
      const clientInfo = invoice.client?.clientId || {};
      const unitInfo = invoice.unit?.id || {};

      // Calculate totals
      const totalWithPenalty = (invoice.totalAmount || 0) + (invoice.penalty || 0);
      const balance = totalWithPenalty - (invoice.amountPaid || 0);

      return {
        ...invoice,
        tenantInfo: clientInfo ? {
          fullName: `${clientInfo.firstName} ${clientInfo.lastName}`.trim(),
          firstName: clientInfo.firstName,
          lastName: clientInfo.lastName,
          customerType: clientInfo.customerType
        } : null,
        unitInfo: unitInfo ? {
          unitName: unitInfo.name,
          unitId: unitInfo._id
        } : null,
        calculatedBalance: balance,
        totalWithPenalty
      };
    });

    // Calculate summaries by currency
    const currencySummaries = {};
    let totalInvoices = 0;

    for (const invoice of invoicesWithCustomerInfo) {
      totalInvoices++;
      const currencyCode = invoice.currency?.code || 'KES';

      if (!currencySummaries[currencyCode]) {
        currencySummaries[currencyCode] = {
          totalAmount: 0,
          amountPaid: 0,
          balance: 0,
          count: 0
        };
      }

      currencySummaries[currencyCode].totalAmount += invoice.totalAmount || 0;
      currencySummaries[currencyCode].amountPaid += invoice.amountPaid || 0;
      currencySummaries[currencyCode].balance += invoice.calculatedBalance || 0;
      currencySummaries[currencyCode].count++;
    }

    const currencies = Object.keys(currencySummaries);
    const hasMixedCurrencies = currencies.length > 1;

    // Return success response with summaries
    return reply.code(200).send({
      success: true,
      message: 'Invoices fetched successfully.',
      data: {
        invoices: invoicesWithCustomerInfo,
        summary: {
          totalInvoices,
          hasMixedCurrencies,
          currencies,
          currencySummaries
        }
      }
    });
  } catch (err) {
    console.error('Error in get_customer_invoices:', err.message, err.stack);
    return reply.code(500).send({
      success: false,
      error: 'An error occurred while fetching invoices.'
    });
  }
};

module.exports = get_customer_invoices;