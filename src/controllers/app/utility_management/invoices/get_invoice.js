const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');
const { getModel } = require('../../../../utils/getModel');

const getSingleWaterInvoice = async (request, reply) => {
  try {
    const { invoiceId } = request.params;
    const { facilityId } = request.query;
    
    // Validate that facilityId is provided
    if (!facilityId) {
      return reply.code(400).send({ 
        success: false,
        message: 'Facility ID is required' 
      });
    }

    // Get the facility-specific model using the facilityId
    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');
    
    // Use the facility-specific model to find the invoice
    const invoice = await WaterInvoiceModel.findById(invoiceId);
    
    if (!invoice) {
      return reply.code(404).send({
        success: false,
        message: 'Water invoice not found'
      });
    }
    
    // Get customer information
    const customer = await payservedb.Customer.findById(invoice.customerId);
    
    // Get facility information
    const facility = await payservedb.Facility.findById(invoice.facilityId);
    
    // Match the response structure to what your component expects
    return reply.code(200).send({
      success: true,
      message: 'Water invoice retrieved successfully',
      data: {
        invoice: {
          ...invoice.toObject(),
          CustomerInfo: customer
            ? {
                fullName: `${customer.firstName} ${customer.lastName}`,
                email: customer.email,
                phone: customer.phone
              }
            : null,
          FacilityInfo: facility
            ? {
                name: facility.name,
                location: facility.location
              }
            : null
        }
      }
    });
  } catch (err) {
    console.error('Error in retrieving water invoice:', err);
    return reply.code(400).send({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = getSingleWaterInvoice;