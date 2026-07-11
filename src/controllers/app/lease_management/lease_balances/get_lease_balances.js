const payservedb = require("payservedb");
const { getModel } = require('../../../../utils/getModel');
const mongoose = require("mongoose");

const getLeaseCustomerBalances = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { asOfDate } = request.query;
    const date = asOfDate ? new Date(asOfDate) : new Date();

    const invoiceModel = await getModel("Invoice", payservedb.Invoice.schema, facilityId);

    // Get all lease invoices for the facility
    const query = {
      "whatFor.invoiceType": { $in: ["Lease"] },
      "facility.id": new mongoose.Types.ObjectId(facilityId.trim()),
      issueDate: { $lte: date },
      status: { $ne: "Void" }
    };

    const leaseInvoices = await invoiceModel.find(query);

    // Group invoices by customer
    const customerBalances = {};

    leaseInvoices.forEach(invoice => {
      const invoiceObj = invoice.toObject();
      const customerId = invoiceObj.client?.clientId?.toString();

      // Skip if no valid customer ID
      if (!customerId) return;

      // Initialize customer if not exists
      if (!customerBalances[customerId]) {
        customerBalances[customerId] = {
          customerId: invoiceObj.client.clientId,
          accountNumber: invoiceObj.accountNumber,
          customer: {
            id: invoiceObj.client.clientId,
            firstName: invoiceObj.client.firstName,
            lastName: invoiceObj.client.lastName,
            fullName: `${invoiceObj.client.firstName} ${invoiceObj.client.lastName}`
          },
          facility: invoiceObj.facility,
          unit: invoiceObj.unit,
          currency: invoiceObj.currency,
          totalInvoiced: 0,
          totalPaid: 0,
          currentBalance: 0,
          overdueAmount: 0,
          invoices: [],
          overdueInvoices: []
        };
      }

      // Calculate payments made up to the specified date
      let paymentsMadeByDate = 0;
      if (invoiceObj.reconciliationHistory && invoiceObj.reconciliationHistory.length > 0) {
        paymentsMadeByDate = invoiceObj.reconciliationHistory
          .filter(payment => new Date(payment.date) <= date)
          .reduce((sum, payment) => sum + payment.amount, 0);
      }

      // Calculate outstanding balance for this invoice
      const outstandingBalance = invoiceObj.totalAmount - paymentsMadeByDate;

      // Update customer totals
      customerBalances[customerId].totalInvoiced += invoiceObj.totalAmount;
      customerBalances[customerId].totalPaid += paymentsMadeByDate;
      customerBalances[customerId].currentBalance += outstandingBalance;

      // Add invoice details
      const invoiceDetails = {
        invoiceId: invoiceObj._id,
        invoiceNumber: invoiceObj.invoiceNumber,
        totalAmount: invoiceObj.totalAmount,
        amountPaid: paymentsMadeByDate,
        outstandingBalance: outstandingBalance,
        issueDate: invoiceObj.issueDate,
        dueDate: invoiceObj.dueDate,
        description: invoiceObj.items[0]?.description || 'Lease Payment',
        status: invoiceObj.status
      };

      customerBalances[customerId].invoices.push(invoiceDetails);

      // Check if overdue and has outstanding balance
      if (date > new Date(invoiceObj.dueDate) && outstandingBalance > 0) {
        customerBalances[customerId].overdueAmount += outstandingBalance;
        customerBalances[customerId].overdueInvoices.push(invoiceDetails);
      }
    });

    // Convert to array and add balance status
    const customersArray = Object.values(customerBalances).map(customer => ({
      ...customer,
      balanceStatus: customer.currentBalance > 0 ? 'Outstanding' :
        customer.currentBalance < 0 ? 'Overpayment' : 'Paid',
      isOverdue: customer.overdueAmount > 0
    }));

    // Calculate summary
    const summary = {
      totalCustomers: customersArray.length,
      customersWithOverpayment: customersArray.filter(c => c.currentBalance < 0).length,
      customersWithOutstanding: customersArray.filter(c => c.currentBalance > 0).length,
      customersWithZeroBalance: customersArray.filter(c => c.currentBalance === 0).length,
      customersOverdue: customersArray.filter(c => c.isOverdue).length,
      totalOutstandingAmount: customersArray.reduce((sum, c) => sum + Math.max(0, c.currentBalance), 0),
      totalOverpaymentAmount: Math.abs(customersArray.reduce((sum, c) => sum + Math.min(0, c.currentBalance), 0)),
      totalOverdueAmount: customersArray.reduce((sum, c) => sum + c.overdueAmount, 0)
    };

    const result = {
      asOfDate: date,
      invoiceType: "Lease",
      facilityId: facilityId,
      summary: summary,
      customers: customersArray
    };

    return reply.code(200).send(result);

  } catch (error) {
    console.error("Error generating lease customer balance report:", error.message);
    return reply.code(500).send({ message: error.message });
  }
};

module.exports = getLeaseCustomerBalances;
