const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get Payment Reports
 * Shows all payments including prepaid credits and postpaid reconciliations
 */
const getPaymentReport = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { 
      searchQuery, 
      paymentType, 
      paymentMethod, 
      startDate, 
      endDate,
      limit = 50, 
      skip = 0 
    } = request.query;
    
    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required'
      });
    }

    // Get models
    const WaterPrepaidCreditModel = await utilityDb.getModel('WaterPrepaidCredit');
    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

    let allPayments = [];

    // Build date query
    const dateQuery = {};
    if (startDate && endDate) {
      dateQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      dateQuery.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      dateQuery.createdAt = { $lte: new Date(endDate) };
    }

    // ===== FETCH PREPAID CREDITS =====
    if (!paymentType || paymentType === 'All Types' || paymentType === 'Prepaid Credits') {
      const creditQuery = { ...dateQuery };
      
      // Payment method filter for prepaid
      if (paymentMethod && paymentMethod !== 'All Methods') {
        if (paymentMethod === 'Mobile Money') {
          creditQuery.type = 'Mobile Money';
        } else if (paymentMethod === 'Bank') {
          creditQuery.type = 'Bank';
        } else if (paymentMethod === 'Manual' || paymentMethod === 'Cash') {
          creditQuery.type = 'Manual';
        }
      }

      const prepaidCredits = await WaterPrepaidCreditModel.find(creditQuery)
        .sort({ createdAt: -1 })
        .lean();

      // Get account info for prepaid credits
      const accountIds = [...new Set(prepaidCredits.map(c => c.accountId?.toString()).filter(Boolean))];
      const accounts = await WaterMeterAccountModel.find({ _id: { $in: accountIds } }).lean();
      
      const accountMap = {};
      accounts.forEach(a => {
        accountMap[a._id.toString()] = a;
      });

      // Get customer info
      const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
      const customerIds = [...new Set(accounts.map(a => a.customerId?.toString()).filter(Boolean))];
      const customers = await CustomerModel.find({ _id: { $in: customerIds } }).lean();
      
      const customerMap = {};
      customers.forEach(c => {
        customerMap[c._id.toString()] = `${c.firstName || ''} ${c.lastName || ''}`.trim();
      });

      // Process prepaid credits
      prepaidCredits.forEach(credit => {
        const account = accountMap[credit.accountId?.toString()];
        if (!account) return;

        const customerName = customerMap[account.customerId?.toString()] || 'N/A';

        allPayments.push({
          ref: credit.ref,
          customerName,
          accountNumber: account.accountNumber,
          unitName: account.unitName || 'N/A',
          paymentType: 'Prepaid',
          paymentMethod: credit.type,
          amount: credit.amount.toFixed(2),
          invoiceNumber: '(Credit)',
          remainingBalance: 'N/A',
          date: credit.addedOn || new Date(credit.createdAt).toLocaleDateString(),
          time: credit.time || new Date(credit.createdAt).toLocaleTimeString(),
          status: 'Completed',
          sortDate: new Date(credit.createdAt)
        });
      });
    }

    // ===== FETCH POSTPAID PAYMENTS (from reconciliation history) =====
    if (!paymentType || paymentType === 'All Types' || paymentType === 'Postpaid Payments') {
      const invoiceQuery = { 
        facilityId,
        'reconciliationHistory.0': { $exists: true } // Has at least one payment
      };

      // Apply date filter to invoices
      if (dateQuery.createdAt) {
        invoiceQuery.createdAt = dateQuery.createdAt;
      }

      const invoicesWithPayments = await WaterInvoiceModel.find(invoiceQuery)
        .sort({ createdAt: -1 })
        .lean();

      // Get customer info
      const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
      const customerIds = [...new Set(invoicesWithPayments.map(inv => inv.customerId?.toString()).filter(Boolean))];
      const customers = await CustomerModel.find({ _id: { $in: customerIds } }).lean();
      
      const customerMap = {};
      customers.forEach(c => {
        customerMap[c._id.toString()] = `${c.firstName || ''} ${c.lastName || ''}`.trim();
      });

      // Process postpaid payments
      invoicesWithPayments.forEach(invoice => {
        const customerName = customerMap[invoice.customerId?.toString()] || 'N/A';

        invoice.reconciliationHistory.forEach(payment => {
          const paymentDate = new Date(payment.date);

          // Apply date filter to individual payments
          if (startDate && paymentDate < new Date(startDate)) return;
          if (endDate && paymentDate > new Date(endDate)) return;

          // Map payment type to method
          let method = 'Cash';
          const paymentTypeStr = payment.type?.toLowerCase() || '';
          
          if (paymentTypeStr.includes('mobile') || paymentTypeStr.includes('mpesa') || paymentTypeStr.includes('m-pesa')) {
            method = 'Mobile Money';
          } else if (paymentTypeStr.includes('bank')) {
            method = 'Bank';
          } else if (paymentTypeStr.includes('manual')) {
            method = 'Manual';
          }

          // Payment method filter
          if (paymentMethod && paymentMethod !== 'All Methods') {
            if (paymentMethod !== method) return;
          }

          allPayments.push({
            ref: payment.paymentReference || 'N/A',
            customerName,
            accountNumber: invoice.accountNumber,
            unitName: invoice.unitName,
            paymentType: 'Postpaid',
            paymentMethod: method,
            amount: payment.amount.toFixed(2),
            invoiceNumber: invoice.invoiceNumber,
            remainingBalance: payment.remainingBalance ? payment.remainingBalance.toFixed(2) : 'N/A',
            date: paymentDate.toLocaleDateString(),
            time: paymentDate.toLocaleTimeString(),
            status: payment.paymentCompletion || 'Completed',
            sortDate: paymentDate
          });
        });
      });
    }

    // Sort all payments by date (most recent first)
    allPayments.sort((a, b) => b.sortDate - a.sortDate);

    // Apply search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      allPayments = allPayments.filter(item => 
        item.ref?.toLowerCase().includes(search) ||
        item.customerName?.toLowerCase().includes(search) ||
        item.accountNumber?.toLowerCase().includes(search)
      );
    }

    // Remove sortDate before sending response
    allPayments = allPayments.map(({ sortDate, ...rest }) => rest);

    // Pagination
    const totalCount = allPayments.length;
    const paginatedData = allPayments.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    return reply.code(200).send({
      success: true,
      message: 'Payment report retrieved successfully',
      data: {
        totalCount,
        records: paginatedData,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: totalCount > (parseInt(skip) + parseInt(limit)),
          currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });

  } catch (err) {
    console.error('Error in getPaymentReport:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getPaymentReport;