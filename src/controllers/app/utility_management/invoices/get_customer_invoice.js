const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');
const { getModel } = require('../../../../utils/getModel');

const getCustomerWaterInvoices = async (request, reply) => {
  try {
    const { facilityId, customerId } = request.params;
    const { status, startDate, endDate, limit = 50, skip = 0 } = request.query;

    // Validate that facilityId and customerId are provided
    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        message: 'Facility ID is required'
      });
    }

    if (!customerId) {
      return reply.code(400).send({
        success: false,
        message: 'Customer ID is required'
      });
    }

    // Get the WaterInvoice model from the utility database
    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');

    // Build query filters
    const query = {
      facilityId,
      customerId
    };

    // Add optional status filter
    if (status) {
      query.status = status;
    }

    // Add date range filter if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.createdAt = { $lte: new Date(endDate) };
    }

    // Get count of total documents matching the query
    const totalCount = await WaterInvoiceModel.countDocuments(query);

    // Get invoices with pagination
    const invoices = await WaterInvoiceModel.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    // Get customer information from payservedb
    let customer = null;
    let customerInfo = null;

    if (customerId) {
      try {
        // Try direct access first
        try {
          customer = await payservedb.Customer.findById(customerId);
        } catch (directErr) {
          // Direct access failed
        }

        // Method 2: If direct access fails, try getModel approach
        if (!customer) {
          try {
            const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
            customer = await CustomerModel.findById(customerId);
          } catch (modelErr) {
            // getModel with facilityId failed
          }
        }

        // Method 3: Try without facilityId in getModel
        if (!customer) {
          try {
            const CustomerModel = await getModel('Customer', payservedb.Customer.schema);
            customer = await CustomerModel.findById(customerId);
          } catch (noFacilityErr) {
            // All methods failed
          }
        }

        if (customer) {
          customerInfo = {
            fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            email: customer.email || null,
            phoneNumber: customer.phoneNumber || null
          };
        }
      } catch (customerErr) {
        console.error('Error fetching customer:', customerErr);
      }
    }

    if (!customer) {
      return reply.code(404).send({
        success: false,
        message: 'Customer not found'
      });
    }

    // Map through invoices and add customer information
    const invoicesWithInfo = invoices.map(invoice => ({
      ...invoice,
      CustomerInfo: customerInfo
    }));

    return reply.code(200).send({
      success: true,
      message: 'Customer water invoices retrieved successfully',
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
    console.error('Error retrieving customer water invoices:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getCustomerWaterInvoices;