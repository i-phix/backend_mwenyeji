const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');

const getAccountInvoices = async (request, reply) => {
  try {
    const { accountNumber } = request.params;
    const { 
      facilityId, 
      billingType, 
      status, 
      yearMonth,
      customerId,
      limit = 50, 
      skip = 0 
    } = request.query;
    
    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        message: 'Facility ID is required'
      });
    }
    
    // Get the WaterInvoice model from the utility database
    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');
    
    // Build query - use both accountNumber and customerId if available
    const query = { facilityId };
    
    if (accountNumber) {
      query.accountNumber = accountNumber;
    }
    
    if (customerId) {
      query.customerId = customerId;
    }
    
    if (billingType) {
      query.billingType = billingType;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (yearMonth) {
      query.yearMonth = yearMonth;
    }
    
    console.log('Account Invoice Query:', JSON.stringify(query, null, 2));
    
    // Get count and invoices
    const totalCount = await WaterInvoiceModel.countDocuments(query);
    
    const invoices = await WaterInvoiceModel.find(query)
      .sort({ dateIssued: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();
    
    console.log(`Found ${invoices.length} invoices out of ${totalCount} total`);
    
    // Add customer info
    const invoicesWithInfo = await Promise.all(
      invoices.map(async (invoice) => {
        let customerInfo = null;
        
        if (invoice.customerId) {
          try {
            const customer = await payservedb.Customer.findById(invoice.customerId).lean();
            
            if (customer) {
              customerInfo = {
                fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                email: customer.email || null,
                phoneNumber: customer.phoneNumber || null
              };
            }
          } catch (customerErr) {
            console.error(`Error fetching customer:`, customerErr.message);
          }
        }
        
        return {
          ...invoice,
          CustomerInfo: customerInfo
        };
      })
    );
    
    return reply.code(200).send({
      success: true,
      message: 'Account invoices retrieved successfully',
      data: {
        totalCount,
        invoices: invoicesWithInfo,
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
    console.error('Error retrieving account invoices:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getAccountInvoices;