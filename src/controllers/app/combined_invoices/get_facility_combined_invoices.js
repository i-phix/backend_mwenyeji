const payservedb = require("payservedb");
const { getModel } = require('../../../utils/getModel');

/**
 * Get all combined invoices for a facility
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Object} Combined invoices for the facility
 */
const getFacilityCombinedInvoices = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Optional query parameters for filtering
    const {
      period,
      status,
      customerId,
      unitId,
      limit,
      skip,
      sortBy = "issueDate",
      sortOrder = "desc",
    } = request.query;

    // Get the model for the specified facility
    const CombinedInvoiceModel = await getModel(
      "CombinedInvoice",
      payservedb.CombinedInvoice.schema,
      facilityId
    );

    // Build filter query
    const filter = {
      "facility.id": facilityId,
    };

    // Add optional filters
    if (period) {
      filter.period = period;
    }

    if (status) {
      filter.status = status;
    }

    if (customerId) {
      filter["customer.customerId"] = customerId;
    }

    if (unitId) {
      filter["unit.id"] = unitId;
    }

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with optional pagination
    let query = CombinedInvoiceModel.find(filter).sort(sortOptions);

    if (skip) {
      query = query.skip(parseInt(skip));
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const combinedInvoices = await query.lean();

    // Get total count for pagination
    const totalCount = await CombinedInvoiceModel.countDocuments(filter);

    // Process invoices to add additional computed fields
    const processedInvoices = combinedInvoices.map((invoice) => ({
      ...invoice,
      customerInfo: {
        fullName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        customerId: invoice.customer.customerId,
        accountNumber: invoice.customer.accountNumber,
      },
      unitInfo: {
        unitId: invoice.unit.id,
        unitName: invoice.unit.name,
      },
      facilityInfo: {
        facilityId: invoice.facility.id,
        facilityName: invoice.facility.name,
      },
      invoiceCount: invoice.invoices?.length || 0,
      calculatedBalance:
        invoice.totalAmount -
        (invoice.amountPaid || 0) +
        (invoice.totalBalanceBroughtForward || 0),
      invoiceTypes: invoice.invoices
        ? [...new Set(invoice.invoices.map((inv) => inv.type))]
        : [],
    }));

    return reply.code(200).send({
      success: true,
      data: processedInvoices,
      meta: {
        total: totalCount,
        count: processedInvoices.length,
        skip: skip ? parseInt(skip) : 0,
        limit: limit ? parseInt(limit) : processedInvoices.length,
      },
    });
  } catch (error) {
    console.error(
      "Error occurred while fetching facility combined invoices:",
      error.message
    );
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = getFacilityCombinedInvoices;