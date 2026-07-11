const utilityDb = require('../../../../middlewares/utilityDb');

/**
 * Get Arrears Aging Report
 * Shows outstanding balances by aging periods
 * Customer information is retrieved from WaterMeterAccount, not Customer collection
 */
const getArrearsAgingReport = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { 
      searchQuery, 
      agingBracket, 
      meterType, 
      sortBy,
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
    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

    // Query for unpaid/partially paid/overdue invoices only
    const invoiceQuery = { 
      facilityId,
      status: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
    };

    // Get all relevant invoices
    const invoices = await WaterInvoiceModel.find(invoiceQuery)
      .sort({ dueDate: 1 })
      .lean();

    console.log(`Found ${invoices.length} unpaid/overdue invoices for facility ${facilityId}`);

    // Get meter accounts which contain customer name and phone
    const accountNumbers = [...new Set(invoices.map(inv => inv.accountNumber).filter(Boolean))];
    const accounts = await WaterMeterAccountModel.find({ 
      $or: [
        { accountNumber: { $in: accountNumbers } },
        { account_no: { $in: accountNumbers } }
      ]
    }).lean();

    console.log(`Found ${accounts.length} meter accounts for ${accountNumbers.length} invoice account numbers`);

    // Create account map with customer info from the account itself
    const accountMap = {};
    accounts.forEach(a => {
      const accNum = a.accountNumber || a.account_no;
      if (accNum) {
        accountMap[accNum] = {
          ...a,
          customerName: a.customerName || 'N/A',
          phoneNumber: a.phoneNumber || a.phone || 'N/A',
          meterId: a.meterId || a.meter_id
        };
      }
    });
    
    console.log(`Account map created for ${Object.keys(accountMap).length} accounts with customer info`);

    // Get meter info for meter types
    const meterIds = accounts.map(a => a.meterId || a.meter_id).filter(Boolean);
    const meters = await WaterMeterModel.find({ _id: { $in: meterIds } }).lean();
    
    const meterMap = {};
    meters.forEach(m => {
      meterMap[m._id.toString()] = m.meterType || m.meter_type || 'N/A';
    });
    
    console.log(`Meter map created for ${Object.keys(meterMap).length} meters`);

    // Group invoices by customer AND account number (composite key)
    // This is important because one customer can have multiple meter accounts
    const customerArrears = {};
    const today = new Date();

    invoices.forEach(invoice => {
      const customerId = invoice.customerId?.toString();
      const accountNumber = invoice.accountNumber;
      
      if (!customerId || !accountNumber) {
        console.log('Skipping invoice without customerId or accountNumber:', invoice.invoiceNumber);
        return;
      }

      // Create composite key: customerId + accountNumber
      const compositeKey = `${customerId}_${accountNumber}`;

      const account = accountMap[accountNumber];
      
      // Get customer info from the account (not from Customer collection)
      const customerName = account?.customerName || 'N/A';
      const phoneNumber = account?.phoneNumber || 'N/A';
      
      // Get meter type
      const meterId = account?.meterId?.toString();
      const meterTypeValue = meterId ? (meterMap[meterId] || 'N/A') : 'N/A';

      // Apply meter type filter
      if (meterType && meterType !== 'All Meters') {
        const filterMeterType = meterType === 'Smart Meters' ? 'Smart' : 'Analog';
        if (meterTypeValue !== filterMeterType) return;
      }

      if (!customerArrears[compositeKey]) {
        customerArrears[compositeKey] = {
          customerId: customerId,
          customerName: customerName,
          accountNumber: accountNumber,
          unitName: invoice.unitName || account?.unitName || 'N/A',
          meterType: meterTypeValue,
          contactPhone: phoneNumber,
          totalArrears: 0,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          over90: 0,
          lastPaymentDate: null,
          oldestInvoiceDate: invoice.dueDate
        };
      }

      const totalAmount = invoice.charges?.totalMonthlyBill || 0;
      const amountPaid = invoice.amountPaid || 0;
      const balance = totalAmount - amountPaid;

      if (balance <= 0) return;

      // Calculate days overdue
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      // Categorize by aging bracket
      if (daysOverdue < 0) {
        customerArrears[compositeKey].current += balance;
      } else if (daysOverdue <= 30) {
        customerArrears[compositeKey].days1_30 += balance;
      } else if (daysOverdue <= 60) {
        customerArrears[compositeKey].days31_60 += balance;
      } else if (daysOverdue <= 90) {
        customerArrears[compositeKey].days61_90 += balance;
      } else {
        customerArrears[compositeKey].over90 += balance;
      }

      customerArrears[compositeKey].totalArrears += balance;

      // Track last payment date
      if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
        const lastPayment = invoice.reconciliationHistory[invoice.reconciliationHistory.length - 1];
        const paymentDate = new Date(lastPayment.date);
        
        if (!customerArrears[compositeKey].lastPaymentDate || paymentDate > customerArrears[compositeKey].lastPaymentDate) {
          customerArrears[compositeKey].lastPaymentDate = paymentDate;
        }
      }
    });

    console.log(`Aggregated arrears for ${Object.keys(customerArrears).length} customer accounts (customerId + accountNumber combinations)`);

    // Convert to array and format
    let arrearsData = Object.values(customerArrears).map(item => ({
      customerName: item.customerName,
      accountNumber: item.accountNumber,
      unitName: item.unitName,
      meterType: item.meterType,
      totalArrears: parseFloat(item.totalArrears.toFixed(2)),
      current: parseFloat(item.current.toFixed(2)),
      days1_30: parseFloat(item.days1_30.toFixed(2)),
      days31_60: parseFloat(item.days31_60.toFixed(2)),
      days61_90: parseFloat(item.days61_90.toFixed(2)),
      over90: parseFloat(item.over90.toFixed(2)),
      lastPaymentDate: item.lastPaymentDate ? item.lastPaymentDate.toLocaleDateString() : 'No Payment',
      contactPhone: item.contactPhone
    }));

    // Apply aging bracket filter
    if (agingBracket && agingBracket !== 'All Aging Brackets') {
      arrearsData = arrearsData.filter(item => {
        switch(agingBracket) {
          case 'Current (Not Due)':
            return item.current > 0;
          case '1-30 Days Overdue':
            return item.days1_30 > 0;
          case '31-60 Days Overdue':
            return item.days31_60 > 0;
          case '61-90 Days Overdue':
            return item.days61_90 > 0;
          case 'Over 90 Days':
            return item.over90 > 0;
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      arrearsData = arrearsData.filter(item => 
        item.customerName?.toLowerCase().includes(search) ||
        item.accountNumber?.toLowerCase().includes(search) ||
        item.unitName?.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    if (sortBy) {
      switch(sortBy) {
        case 'Sort: Highest Balance':
          arrearsData.sort((a, b) => b.totalArrears - a.totalArrears);
          break;
        case 'Sort: Oldest First':
          arrearsData.sort((a, b) => b.over90 - a.over90);
          break;
        case 'Sort: Customer Name':
          arrearsData.sort((a, b) => a.customerName.localeCompare(b.customerName));
          break;
      }
    } else {
      // Default: sort by highest balance
      arrearsData.sort((a, b) => b.totalArrears - a.totalArrears);
    }

    // Calculate summary statistics
    const summary = {
      totalArrears: parseFloat(arrearsData.reduce((sum, item) => sum + item.totalArrears, 0).toFixed(2)),
      accountsInArrears: arrearsData.length,
      current: parseFloat(arrearsData.reduce((sum, item) => sum + item.current, 0).toFixed(2)),
      overdue: parseFloat(arrearsData.reduce((sum, item) => 
        sum + item.days1_30 + item.days31_60 + item.days61_90 + item.over90, 0
      ).toFixed(2))
    };

    // Pagination
    const totalCount = arrearsData.length;
    const paginatedData = arrearsData.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    console.log(`Returning ${paginatedData.length} records out of ${totalCount} total, Summary:`, summary);

    return reply.code(200).send({
      success: true,
      message: 'Arrears aging report retrieved successfully',
      data: {
        totalCount,
        arrears: paginatedData,  // Changed from 'records' to match frontend expectation
        summary: summary,
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
    console.error('Error in getArrearsAgingReport:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getArrearsAgingReport;