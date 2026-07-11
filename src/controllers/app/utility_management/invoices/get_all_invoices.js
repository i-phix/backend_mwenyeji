const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');

const getFacilityWaterInvoices = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { 
      status, 
      yearMonth,
      startDate, 
      endDate, 
      customerId, 
      searchTerm,
      limit = 50, 
      skip = 0 
    } = request.query;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required'
      });
    }

    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');
    const query = { facilityId };

    // Basic filters
    if (status) query.status = status;
    if (yearMonth) query.yearMonth = yearMonth;
    if (customerId) query.customerId = customerId;
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.createdAt = { $lte: new Date(endDate) };
    }

    let customerIds = [];
    if (searchTerm && searchTerm.trim()) {
      const searchRegex = new RegExp(searchTerm.trim(), 'i');

      try {
        const customers = await payservedb.Customer.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex }
          ]
        }).select('_id').lean();

        if (customers.length > 0) {
          customerIds = customers.map(c => c._id);
          query.customerId = { $in: customerIds };
        } else {
          // No matches -> return empty
          return reply.code(200).send({
            success: true,
            data: { totalCount: 0, invoices: [] }
          });
        }
      } catch (err) {
        console.error('Customer name search failed:', err.message);
      }
    }

    console.log('Final Query:', JSON.stringify(query, null, 2));

    const totalCount = await WaterInvoiceModel.countDocuments(query);
    const invoices = await WaterInvoiceModel.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const invoicesWithInfo = await Promise.all(
      invoices.map(async (invoice) => {
        let customer = await payservedb.Customer.findById(invoice.customerId).lean();
        return {
          ...invoice,
          CustomerInfo: customer
            ? {
                fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                email: customer.email,
                phoneNumber: customer.phoneNumber
              }
            : null
        };
      })
    );

    return reply.code(200).send({
      success: true,
      data: {
        totalCount,
        invoices: invoicesWithInfo,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: totalCount > skip + limit
        }
      }
    });

  } catch (err) {
    console.error('Error in getFacilityWaterInvoices:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getFacilityWaterInvoices;
