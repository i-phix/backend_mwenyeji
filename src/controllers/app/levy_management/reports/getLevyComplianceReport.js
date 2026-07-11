const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getLevyComplianceReport = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { 
      search, 
      complianceStatus = 'All', 
      period = 'Last 12 Months',
      minRate = 0,
      page = 1, 
      limit = 10 
    } = request.query;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required.'
      });
    }

    // Load dynamic models
    const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
    const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
    const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const customerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);

    // Helper: Format date as YYYY-MM
    const getYearMonth = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Helper: Get all months between start & end
    const getYearMonthsInRange = (startDate, endDate) => {
      const months = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        months.push(getYearMonth(current));
        current.setMonth(current.getMonth() + 1);
      }
      return months;
    };

    // Determine time period
    const today = new Date();
    let startDate;
    switch (period) {
      case 'Last 3 Months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        break;
      case 'Last 6 Months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
        break;
      case 'Current Year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
    }
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const yearMonths = getYearMonthsInRange(startDate, endDate);

    // Fetch all active contracts for facility
    const contracts = await levyContractModel.find({
      facilityId,
      status: 'Active'
    })
    .populate({ path: 'levyId', model: levyModel, select: 'levyName' })
    .populate({ path: 'unitId', model: unitModel, select: 'name' })
    .populate({ path: 'customerId', model: customerModel, select: 'firstName lastName companyName' })
    .lean();

    // Fetch invoices for that period
    const periodInvoices = await invoiceModel.find({
      'facility.id': facilityId,
      yearMonth: { $in: yearMonths },
      status: { $in: ['Unpaid', 'Pending', 'Paid', 'Partially Paid', 'Overdue'] }
    })
    .select('client status issueDate dueDate amountPaid totalAmount whatFor paymentDetails')
    .lean();

    const complianceData = [];

    // Iterate contracts and match invoices
    for (const contract of contracts) {
      const customerId = contract.customerId?._id?.toString() || contract.customerId?.toString();
      const levyName = contract.levyId?.levyName || 'N/A';

      const contractInvoices = periodInvoices.filter(invoice => {
        const invoiceClientId = invoice.client?.clientId?.toString();
        const isContractInvoice =
          invoice.whatFor?.invoiceType === 'Contract' &&
          invoice.whatFor?.description?.toString() === contract._id.toString();

        return invoiceClientId === customerId && isContractInvoice;
      });

      if (contractInvoices.length === 0) continue;

      // Track compliance stats
      let paidOnTime = 0;
      let paidLate = 0;
      let unpaid = 0;
      let totalDaysLate = 0;
      let latePaymentCount = 0;
      let lastPaymentDate = null;

      for (const invoice of contractInvoices) {
        const dueDate = new Date(invoice.dueDate);
        const paymentDate = invoice.paymentDetails?.paymentDate
          ? new Date(invoice.paymentDetails.paymentDate)
          : null;

        if (invoice.status === 'Paid') {
          if (paymentDate && paymentDate <= dueDate) {
            paidOnTime++;
          } else {
            paidLate++;
            const daysLate = paymentDate
              ? Math.floor((paymentDate - dueDate) / (1000 * 60 * 60 * 24))
              : 0;
            if (daysLate > 0) {
              totalDaysLate += daysLate;
              latePaymentCount++;
            }
          }
          if (!lastPaymentDate || (paymentDate && paymentDate > lastPaymentDate)) {
            lastPaymentDate = paymentDate;
          }
        } else if (invoice.status === 'Partially Paid') {
          paidLate++;
          const daysLate = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          totalDaysLate += daysLate;
          latePaymentCount++;
        } else if (['Unpaid', 'Overdue'].includes(invoice.status)) {
          unpaid++;
          const daysLate = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          totalDaysLate += daysLate;
          latePaymentCount++;
        }
      }

      const totalInvoices = contractInvoices.length;
      const complianceRate = totalInvoices > 0
        ? Math.round((paidOnTime / totalInvoices) * 100)
        : 0;
      const avgDaysLate = latePaymentCount > 0
        ? Math.round(totalDaysLate / latePaymentCount)
        : 0;

      let status = 'Non-Compliant';
      if (complianceRate >= 80) status = 'Compliant';
      else if (complianceRate >= 50) status = 'Partially Compliant';

      // Apply filters
      if (complianceStatus !== 'All' && complianceStatus !== status) continue;
      if (complianceRate < parseFloat(minRate)) continue;

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        const unitName = contract.unitId?.name || '';
        const tenant = contract.customerId;
        const tenantName = tenant?.companyName || `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim();
        if (!searchRegex.test(tenantName) && !searchRegex.test(unitName)) continue;
      }

      complianceData.push({
        id: contract._id,
        contractName: contract.contractName,
        unitNumber: contract.unitId?.name || 'N/A',
        tenant: contract.customerId?.companyName || `${contract.customerId?.firstName || ''} ${contract.customerId?.lastName || ''}`.trim(),
        levyName,
        status,
        totalInvoices,
        paidOnTime,
        paidLate,
        unpaid,
        complianceRate,
        avgDaysLate,
        lastPaymentDate
      });
    }

    // Sort by compliance rate ascending
    complianceData.sort((a, b) => a.complianceRate - b.complianceRate);

    // Summary
    const totalContracts = complianceData.length;
    const compliantContracts = complianceData.filter(c => c.status === 'Compliant').length;
    const partiallyCompliant = complianceData.filter(c => c.status === 'Partially Compliant').length;
    const nonCompliant = complianceData.filter(c => c.status === 'Non-Compliant').length;
    const avgComplianceRate = totalContracts > 0
      ? Math.round(complianceData.reduce((sum, c) => sum + c.complianceRate, 0) / totalContracts)
      : 0;
    const totalInvoices = complianceData.reduce((sum, c) => sum + c.totalInvoices, 0);
    const paidOnTimeTotal = complianceData.reduce((sum, c) => sum + c.paidOnTime, 0);

    // Pagination
    const totalCount = complianceData.length;
    const skip = (page - 1) * limit;
    const paginatedCompliance = complianceData.slice(skip, skip + parseInt(limit));

    return reply.code(200).send({
      success: true,
      data: {
        contracts: paginatedCompliance,
        summary: {
          totalContracts,
          compliantContracts,
          partiallyCompliant,
          nonCompliant,
          avgComplianceRate,
          totalInvoices,
          paidOnTime: paidOnTimeTotal
        },
        period: { selected: period, startDate, endDate, yearMonths },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (err) {
    console.error('Error in getLevyComplianceReport:', err.stack);
    return reply.code(500).send({
      success: false,
      error: 'An error occurred while generating the levy compliance report.'
    });
  }
};

module.exports = { getLevyComplianceReport };
