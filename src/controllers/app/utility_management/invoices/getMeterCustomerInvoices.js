const utilityDb = require('../../../../middlewares/utilityDb');

const getMeterCustomerInvoices = async (request, reply) => {
  try {
    const { meterNumber, customerId } = request.params;

    if (!meterNumber || !customerId) {
      return reply.code(400).send({
        success: false,
        message: 'Meter number and customer ID are required'
      });
    }

    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');

    const invoices = await WaterInvoiceModel.find({
      meterNumber,
      customerId
    })
      .sort({ createdAt: -1 })
      .lean();

    return reply.code(200).send({
      success: true,
      message: 'Meter invoices retrieved successfully',
      data: {
        totalCount: invoices.length,
        invoices
      }
    });
  } catch (err) {
    console.error('Error retrieving meter invoices:', err);
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getMeterCustomerInvoices;