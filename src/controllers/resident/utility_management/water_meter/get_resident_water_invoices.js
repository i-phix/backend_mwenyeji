const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');

const getInvoicesByCustomerId = async (request, reply) => {
  try {
    const { customerId } = request.params;

    // Get the invoice model
    const InvoiceModel = await utilityDb.getModel('WaterInvoice');

    // Find all invoices for the customer
    const invoices = await InvoiceModel.find({ customerId });

    if (!invoices || invoices.length === 0) {
      return reply.code(404).send({
        success: false,
        message: 'No invoices found for this customer'
      });
    }

    // Fetch customer information
    const customer = await payservedb.Customer.findById(customerId);

    // Add facility info to each invoice
    const invoicesWithDetails = await Promise.all(
      invoices.map(async (invoice) => {
        const facility = await payservedb.Facility.findById(invoice.facilityId);
        return {
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
        };
      })
    );

    return reply.code(200).send({
      success: true,
      message: 'Invoices retrieved successfully',
      data: {
        invoices: invoicesWithDetails
      }
    });
  } catch (err) {
    console.error('Error retrieving invoices:', err);
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getInvoicesByCustomerId;
