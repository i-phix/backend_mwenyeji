const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');

const filterFacilityInvoices = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { unitName, customerName, limit = 50, skip = 0 } = request.query;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required',
      });
    }

    const WaterInvoiceModel = await utilityDb.getModel('WaterInvoice');

    // Base query: filter by facilityId
    const query = { facilityId };

    // Optional: filter by unit name
    if (unitName) {
      query.unitName = { $regex: new RegExp(unitName, 'i') };
    }

    // Optional: filter by customer name
    if (customerName) {
      const customers = await payservedb.Customer.find({
        $or: [
          { firstName: { $regex: new RegExp(customerName, 'i') } },
          { lastName: { $regex: new RegExp(customerName, 'i') } },
        ],
      }).select('_id');

      const customerIds = customers.map(c => c._id);
      if (customerIds.length > 0) {
        query.customerId = { $in: customerIds };
      } else {
        // No matching customers → no invoices
        return reply.code(200).send({
          success: true,
          message: 'No invoices found for the given customer name',
          data: [],
        });
      }
    }

    // Fetch filtered invoices
    const invoices = await WaterInvoiceModel.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    return reply.code(200).send({
      success: true,
      message: 'Invoices retrieved successfully',
      data: invoices,
    });
  } catch (err) {
    console.error('Error filtering facility invoices:', err);
    return reply.code(500).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = filterFacilityInvoices;
