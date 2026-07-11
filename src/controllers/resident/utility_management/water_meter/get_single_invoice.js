const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');

const getSingleInvoice = async (request, reply) => {
  try {
    const { invoiceId } = request.params;
    
    // Get the invoice model
    const InvoiceModel = await utilityDb.getModel('WaterInvoice');
    
    // Find the invoice
    const invoice = await InvoiceModel.findById(invoiceId);
    
    if (!invoice) {
      return reply.code(404).send({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    // Get customer information
    const customer = await payservedb.Customer.findById(invoice.customerId);
    
    // Get facility information
    const facility = await payservedb.Facility.findById(invoice.facilityId);
    
    return reply.code(200).send({
      success: true,
      message: 'Invoice retrieved successfully',
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
    console.error('Error retrieving invoice:', err);
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getSingleInvoice;