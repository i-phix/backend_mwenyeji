const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_property_managed_invoices = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { status, startDate, endDate, page = 1, limit = 10 } = request.query;

    // Get the tenant-specific models
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

    // First, get all units managed by property management
    const propertyManagedUnits = await unitModel.find({ 
      facilityId,
      isManagedByPropertyManager: true 
    }).select('_id name unitType division tenantId homeOwnerId');

    if (propertyManagedUnits.length === 0) {
      return reply.code(200).send({ 
        success: true,
        message: "No property managed units found",
        invoices: [], 
        totalInvoices: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        propertyManagedUnitsCount: 0
      });
    }

    // Extract unit IDs for invoice query
    const unitIds = propertyManagedUnits.map(unit => unit._id);

    // Build invoice query - Filter specifically for Property Management invoices
    let invoiceQuery = {
      'facility.id': facilityId,
      'unit.id': { $in: unitIds },
      'whatFor.invoiceType': 'Property-Management'
    };

    // Add optional filters
    if (status) {
      invoiceQuery.status = status;
    }

    if (startDate || endDate) {
      invoiceQuery.issueDate = {};
      if (startDate) {
        invoiceQuery.issueDate.$gte = new Date(startDate);
      }
      if (endDate) {
        invoiceQuery.issueDate.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const totalInvoices = await invoiceModel.countDocuments(invoiceQuery);

    // Fetch invoices with pagination
    const invoices = await invoiceModel
      .find(invoiceQuery)
      .select({
        invoiceNumber: 1,
        accountNumber: 1,
        client: 1,
        facility: 1,
        unit: 1,
        currency: 1,
        totalAmount: 1,
        amountPaid: 1,
        balanceBroughtForward: 1,
        issueDate: 1,
        dueDate: 1,
        status: 1,
        whatFor: 1,
        penalty: 1,
        items: 1,
        invoiceDoubleEntryAccount: 1,
        paymentDoubleEntryAccount: 1,
        accountdebitedData: 1,
        accountcreditedData: 1,
        createdAt: 1
      })
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    if (!invoices.length) {
      return reply.code(200).send({
        success: true,
        message: "No property management invoices found",
        data: [],
        totalInvoices: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        propertyManagedUnitsCount: propertyManagedUnits.length
      });
    }

    // Get units with customer information - Focus on home owners as clients
    const unitsWithCustomers = await unitModel.find({ 
      _id: { $in: unitIds }
    })
    .populate({
      path: 'homeOwnerId', 
      model: payservedb.Customer,
      select: 'firstName lastName phoneNumber email customerType status'
    })
    .populate({
      path: 'tenantId',
      model: payservedb.Customer,
      select: 'firstName lastName phoneNumber email customerType status'
    })
    .lean();

    // Create a map of units with their customer info
    const unitMap = unitsWithCustomers.reduce((map, unit) => {
      map[unit._id.toString()] = unit;
      return map;
    }, {});

    // Enhance invoices with customer and unit information
    const enhancedInvoices = invoices.map(invoice => {
      const unit = unitMap[invoice.unit.id.toString()];
      const homeOwner = unit?.homeOwnerId; // Priority is home owner as client
      const tenant = unit?.tenantId;

      // Add default currency if missing
      if (!invoice.currency) {
        invoice.currency = {
          code: 'KES',
          name: 'Kenyan Shilling'
        };
      }

      // Client info - Priority is home owner (the actual client for property management)
      let clientInfo;
      if (homeOwner) {
        clientInfo = {
          fullName: `${homeOwner.firstName} ${homeOwner.lastName}`,
          firstName: homeOwner.firstName,
          lastName: homeOwner.lastName,
          clientId: homeOwner._id,
          customerType: homeOwner.customerType,
          email: homeOwner.email,
          phoneNumber: homeOwner.phoneNumber,
          status: homeOwner.status
        };
      } else if (tenant) {
        // Fallback to tenant if no home owner
        clientInfo = {
          fullName: `${tenant.firstName} ${tenant.lastName}`,
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          clientId: tenant._id,
          customerType: tenant.customerType,
          email: tenant.email,
          phoneNumber: tenant.phoneNumber,
          status: tenant.status
        };
      } else {
        clientInfo = {
          fullName: 'No Client Assigned',
          firstName: '',
          lastName: '',
          clientId: null,
          customerType: '',
          email: '',
          phoneNumber: '',
          status: ''
        };
      }

      return {
        ...invoice,
        clientInfo, // Use clientInfo instead of customerInfo
        client: {
          ...invoice.client,
          ...clientInfo
        },
        unit: {
          ...invoice.unit,
          unitType: unit?.unitType,
          division: unit?.division,
          isManagedByPropertyManager: unit?.isManagedByPropertyManager,
          propertyManagerName: unit?.propertyManagerName
        },
        calculatedBalance: invoice.totalAmount - (invoice.amountPaid || 0) + (invoice.balanceBroughtForward || 0)
      };
    });

    // Calculate financial summaries
    const financialSummary = await invoiceModel.aggregate([
      { $match: invoiceQuery },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = financialSummary[0] || { totalAmount: 0, totalPaid: 0, count: 0 };
    const totalOutstanding = summary.totalAmount - summary.totalPaid;

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalInvoices / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    // Group invoices by status for additional insights
    const statusSummary = await invoiceModel.aggregate([
      { $match: invoiceQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' }
        }
      }
    ]);

    // Property management specific insights
    const propertyManagementSummary = await invoiceModel.aggregate([
      { $match: invoiceQuery },
      {
        $group: {
          _id: { 
            month: { $month: '$issueDate' },
            year: { $year: '$issueDate' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    return reply.code(200).send({
      success: true,
      message: "Property management invoices retrieved successfully",
      data: enhancedInvoices,
      totalInvoices,
      totalAmount: summary.totalAmount,
      totalPaid: summary.totalPaid,
      totalOutstanding,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNext,
        hasPrev
      },
      propertyManagedUnitsCount: propertyManagedUnits.length,
      statusSummary,
      propertyManagementSummary,
      filters: {
        status,
        startDate,
        endDate,
        invoiceType: 'Property-Management'
      }
    });

  } catch (err) {
    console.error('Error in get_property_managed_invoices:', err);
    return reply.code(502).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = get_property_managed_invoices;