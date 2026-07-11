const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');
const { getModel } = require('../../../../utils/getModel');

const getBillingSummaryReport = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { searchQuery, status, billingType, startDate, endDate, limit = 50, skip = 0 } = request.query;

    if (!facilityId) {
      return reply.code(400).send({ success: false, error: 'Facility ID is required' });
    }

    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');

    const query = { facilityId };

    if (status && status !== 'All Status') query.status = status;
    if (billingType && billingType !== 'All Types') query.billingType = billingType.toLowerCase();

    if (startDate && endDate) {
      query.dateIssued = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      query.dateIssued = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.dateIssued = { $lte: new Date(endDate) };
    }

    const totalCount = await WaterInvoiceModel.countDocuments(query);
    const invoices = await WaterInvoiceModel.find(query)
      .sort({ dateIssued: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const customerIds = [...new Set(invoices.map(inv => inv.customerId?.toString()).filter(Boolean))];
    let customers = [];

    customers = await payservedb.Customer.find({ _id: { $in: customerIds } }).lean();
    if (!customers.length) {
      const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
      customers = await CustomerModel.find({ _id: { $in: customerIds } }).lean();
    }

    const customerMap = {};
    customers.forEach(c => {
      customerMap[c._id.toString()] = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim();
    });

    let billingData = invoices.map(invoice => {
      const customerName = customerMap[invoice.customerId?.toString()] || 'N/A';
      const totalAmount = invoice.charges?.totalMonthlyBill || 0;
      const amountPaid = invoice.amountPaid || 0;
      const balance = totalAmount - amountPaid;

      return {
        invoiceNumber: invoice.invoiceNumber,
        accountNumber: invoice.accountNumber,
        customerName,
        unitName: invoice.unitName,
        billingType: invoice.billingType || 'postpaid',
        consumption: `${invoice.meterReadings?.usage || 0} m³`,
        totalAmount: totalAmount.toFixed(2),
        amountPaid: amountPaid.toFixed(2),
        balance: balance.toFixed(2),
        status: invoice.status,
        dateIssued: new Date(invoice.dateIssued).toLocaleDateString(),
        dueDate: new Date(invoice.dueDate).toLocaleDateString()
      };
    });

    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      billingData = billingData.filter(item =>
        item.invoiceNumber?.toLowerCase().includes(search) ||
        item.customerName?.toLowerCase().includes(search) ||
        item.accountNumber?.toLowerCase().includes(search)
      );
    }

    return reply.code(200).send({
      success: true,
      message: 'Billing summary report retrieved successfully',
      data: {
        totalCount: billingData.length,
        records: billingData,
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
    return reply.code(500).send({ success: false, error: err.message });
  }
};

module.exports = getBillingSummaryReport;
