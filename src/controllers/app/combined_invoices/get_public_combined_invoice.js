const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const mongoose = require("mongoose");

/**
 * Get combined invoice by facilityId + invoiceId
 * When :combined is "true", invoiceId refers to the combined invoice's _id
 * When :combined is "false", invoiceId refers to an individual invoice within a combined invoice
 */
const get_public_combined_invoice = async (request, reply) => {
  try {
    const { facilityId, invoiceId, combined } = request.params;

    console.log('[COMBINED-INVOICE-API] Request params:', { facilityId, invoiceId, combined });

    // Optional safety check if :combined must be true
    if (combined !== "true") {
      return reply.code(400).send({
        success: false,
        error: "Invalid combined invoice request",
      });
    }

    // Get facility-specific CombinedInvoice model
    const CombinedInvoiceModel = await getModel(
      "CombinedInvoice",
      payservedb.CombinedInvoice.schema,
      facilityId
    );

    // ===== FIX: Search by combined invoice _id, not by individual invoice ID =====
    let combinedInvoice;
    
    // Validate if invoiceId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      console.error('[COMBINED-INVOICE-API] Invalid ObjectId format:', invoiceId);
      return reply.code(400).send({
        success: false,
        error: "Invalid invoice ID format",
      });
    }

    // Find combined invoice by its own _id
    combinedInvoice = await CombinedInvoiceModel.findById(invoiceId).lean();

    console.log('[COMBINED-INVOICE-API] Combined invoice found:', combinedInvoice ? 'Yes' : 'No');

    if (!combinedInvoice) {
      console.error('[COMBINED-INVOICE-API] Combined invoice not found for ID:', invoiceId);
      return reply.code(404).send({
        success: false,
        error: "Combined invoice not found",
      });
    }

    console.log('[COMBINED-INVOICE-API] Combined invoice data:', {
      id: combinedInvoice._id,
      invoiceNumber: combinedInvoice.combinedInvoiceNumber,
      period: combinedInvoice.period,
      invoiceCount: combinedInvoice.invoices?.length,
      paymentMethod: combinedInvoice.paymentMethod,
      billerAddressId: combinedInvoice.billerAddressId,
    });

    // Enrich response
    const processedInvoice = {
      ...combinedInvoice,
      customerInfo: {
        fullName: `${combinedInvoice.customer.firstName} ${combinedInvoice.customer.lastName}`,
        customerId: combinedInvoice.customer.customerId,
        accountNumber: combinedInvoice.customer.accountNumber,
      },
      unitInfo: {
        unitId: combinedInvoice.unit.id,
        unitName: combinedInvoice.unit.name,
      },
      facilityInfo: {
        facilityId: combinedInvoice.facility.id,
        facilityName: combinedInvoice.facility.name,
      },
      invoiceCount: combinedInvoice.invoices?.length || 0,
      calculatedBalance:
        combinedInvoice.totalAmount -
        (combinedInvoice.amountPaid || 0) +
        (combinedInvoice.totalBalanceBroughtForward || 0),
      invoiceTypes: combinedInvoice.invoices
        ? [...new Set(combinedInvoice.invoices.map(inv => inv.type))]
        : [],
    };

    console.log('[COMBINED-INVOICE-API] Returning processed invoice with payment method:', processedInvoice.paymentMethod);

    return reply.code(200).send({
      success: true,
      data: processedInvoice,
    });

  } catch (error) {
    console.error("[COMBINED-INVOICE-API] Error fetching combined invoice:", error);
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = get_public_combined_invoice;