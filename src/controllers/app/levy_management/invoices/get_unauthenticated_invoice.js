// controllers/app/settings_management/get_unauthenticated_invoice.js
const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");
const logger = require("./../../../../../config/winston");

/**
 * Retrieves invoice data for public (unauthenticated) access
 * This endpoint is used for links sent in reminder notifications
 * 
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 * @returns {Promise<Object>} - JSON response with invoice data or error
 */
const get_unauthenticated_invoice = async (request, reply) => {
  // Store request parameters in local variables to ensure proper scope
  const facilityId = request.params.facilityId;
  const invoiceId = request.params.invoiceId;
  const type = request.params.type;

  try {
    if (!facilityId || !invoiceId) {
      logger.warn(`Missing required parameters: facilityId=${facilityId}, invoiceId=${invoiceId}`);
      return reply.code(400).send({
        success: false,
        message: "Facility ID and Invoice ID are required"
      });
    }

    logger.info(`Public invoice access request for facility ${facilityId}, invoice ${invoiceId}`);

    // Get the Invoice model for this facility
    const invoiceModel = await getModel(
      "Invoice",
      payservedb.Invoice.schema,
      facilityId
    );

    if (!invoiceModel) {
      logger.error(`Failed to get Invoice model for facility ${facilityId}`);
      return reply.code(500).send({
        success: false,
        message: "Error accessing invoice data"
      });
    }

    // Find the invoice
    const invoice = await invoiceModel.findOne({ _id: invoiceId }).lean();

    if (!invoice) {
      logger.warn(`Invoice not found: facilityId=${facilityId}, invoiceId=${invoiceId}`);
      return reply.code(404).send({
        success: false,
        message: "Invoice not found"
      });
    }

    // Determine invoice type if not provided
    const invoiceType = type || (
      invoice.whatFor && invoice.whatFor.invoiceType === 'Lease' ? 'lease' : 'levy'
    );

    logger.debug(`Processing ${invoiceType} invoice ${invoiceId}`);

    // Calculate balance
    const amountPaid = invoice.amountPaid || 0;
    const totalAmount = invoice.totalAmount || 0;
    const balanceBroughtForward = invoice.balanceBroughtForward || 0;
    const calculatedBalance = totalAmount - amountPaid;

    // Prepare customer info safely
    const customerInfo = {
      fullName: `${invoice.client?.firstName || ''} ${invoice.client?.lastName || ''}`.trim(),
      clientId: invoice.client?.clientId || null,
      firstName: invoice.client?.firstName || '',
      lastName: invoice.client?.lastName || ''
    };

    // Format the invoice with client info and calculated balance
    const formattedInvoice = {
      ...invoice,
      calculatedBalance,
      customerInfo,
      invoiceType
    };

    logger.info(`Successfully retrieved public invoice ${invoiceId} for facility ${facilityId}`);

    return reply.code(200).send({
      success: true,
      message: "Invoice retrieved successfully",
      data: formattedInvoice
    });
  } catch (err) {
    logger.error(`Error retrieving public invoice: ${err.message}`, {
      stack: err.stack,
      facilityId,
      invoiceId
    });

    return reply.code(500).send({
      success: false,
      message: "An error occurred while retrieving the invoice"
    });
  }
};

module.exports = get_unauthenticated_invoice;

