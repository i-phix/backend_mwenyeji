const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');

const getCustomerInvoice = async (request, reply) => {
  try {
    const { customerId, invoiceId } = request.params;

    // Get the invoice model
    const InvoiceModel = await utilityDb.getModel('WaterInvoice');

    // Find invoice by both invoiceId and customerId
    const invoice = await InvoiceModel.findOne({ _id: invoiceId, customerId });

    if (!invoice) {
      return reply.code(404).send({
        success: false,
        message: 'Invoice not found for this customer'
      });
    }

    // Fetch customer info
    const customer = await payservedb.Customer.findById(customerId);

    // Fetch facility info
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
    console.error('Error retrieving customer invoice:', err);
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getCustomerInvoice;
