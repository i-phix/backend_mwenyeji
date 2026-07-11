/**
 * Zoho Books Integration Controller
 * Handles all Zoho Books API operations
 *
 * Features:
 * - Comprehensive Logging: All operations logged for debugging
 * - Graceful Degradation: Failures don't break the system
 * - Idempotent Operations: Safe to retry without duplicates
 */

const logger = require("../../../../config/winston");

const {
  sendInvoiceToZoho,
  bulkSendInvoicesToZoho,
  testZohoConnection,
  validateInvoiceData,
} = require("../../../services/integrations/zoho/send_invoice");

const {
  getTokenStatus,
  refreshAccessToken,
  validateCredentials,
  initializeTokenData,
  updateRefreshToken,
} = require("../../../services/integrations/zoho/auth");
const { ZOHO_CONFIG } = require("../../../services/integrations/zoho/config");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const { decrypt } = require("../../../utils/encryption");

/**
 * Helper function to load and apply facility-specific Zoho credentials
 * @param {string} facilityId - The facility ID to load credentials for
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function loadFacilityZohoCredentials(facilityId) {
  if (!facilityId) {
    return { success: false, error: "facilityId is required" };
  }

  try {
    const ZohoIntegrationModel = await getModel(
      "ZohoIntegration",
      payservedb.ZohoIntegration.schema,
      facilityId,
    );

    const zohoCfg = await ZohoIntegrationModel.findOne({ facilityId });

    if (!zohoCfg) {
      logger.warn("No Zoho configuration found for facility", { facilityId });
      return {
        success: false,
        error: "No Zoho configuration found for facility",
      };
    }

    // Decrypt sensitive credentials
    let decClientSecret = null;
    let decRefreshToken = null;
    let decAccessToken = null;

    try {
      decClientSecret = zohoCfg.clientSecret
        ? decrypt(zohoCfg.clientSecret)
        : null;
      decRefreshToken = zohoCfg.refreshToken
        ? decrypt(zohoCfg.refreshToken)
        : null;
      decAccessToken = zohoCfg.accessToken
        ? decrypt(zohoCfg.accessToken)
        : null;
    } catch (e) {
      logger.error("Failed to decrypt Zoho credentials", {
        facilityId,
        error: e.message,
      });
      return { success: false, error: "Failed to decrypt Zoho credentials" };
    }

    // Apply facility credentials to runtime Zoho config
    ZOHO_CONFIG.clientId = zohoCfg.clientId || ZOHO_CONFIG.clientId;
    ZOHO_CONFIG.clientSecret = decClientSecret || ZOHO_CONFIG.clientSecret;
    ZOHO_CONFIG.refreshToken = decRefreshToken || ZOHO_CONFIG.refreshToken;
    ZOHO_CONFIG.accessToken = decAccessToken || null;
    ZOHO_CONFIG.organizationId =
      zohoCfg.organizationId || ZOHO_CONFIG.organizationId;

    if (zohoCfg.requestTimeout) {
      ZOHO_CONFIG.requestTimeout = zohoCfg.requestTimeout;
    }
    if (typeof zohoCfg.maxRetries === "number") {
      ZOHO_CONFIG.maxRetries = zohoCfg.maxRetries;
    }

    logger.info("Applied facility-specific Zoho configuration", {
      facilityId,
      hasAccessToken: !!ZOHO_CONFIG.accessToken,
    });

    // Seed auth token store for this facility
    if (decRefreshToken) {
      updateRefreshToken(decRefreshToken);
    }
    if (decAccessToken) {
      initializeTokenData(decAccessToken);
    }

    return { success: true };
  } catch (e) {
    logger.error("Failed to load facility Zoho configuration", {
      facilityId,
      error: e.message,
    });
    return {
      success: false,
      error: "Failed to load facility Zoho configuration",
    };
  }
}

const {
  getInvoiceById,
  searchInvoiceByNumber,
  markInvoiceAsSent,
} = require("../../../services/integrations/zoho/invoice");

const {
  createPayment,
  recordInvoicePayment,
} = require("../../../services/integrations/zoho/payment");

const {
  addPaymentToInvoice,
  addMultiplePayments,
  getInvoicePayments: getInvoicePaymentsList,
  getPaymentHistory,
  deletePayment: removePayment,
  updatePayment: modifyPayment,
  validatePaymentData,
  getPaymentModes,
} = require("../../../services/integrations/zoho/payment_advanced");

const {
  getCustomerById,
  searchCustomerByName,
} = require("../../../services/integrations/zoho/customer");

// ============================================================================
// Connection & Health Check
// ============================================================================

/**
 * Test Zoho Books connection
 */
const testConnection = async (request, reply) => {
  try {
    console.log("Testing Zoho Books connection...");
    logger.info("Testing Zoho Books connection");

    const result = await testZohoConnection();

    if (result.success) {
      logger.info("Zoho Books connection test successful");
    } else {
      logger.warn("Zoho Books connection test failed", {
        message: result.message,
      });
    }

    return reply.code(result.success ? 200 : 503).send({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Test connection error:", error);
    logger.error("Zoho Books connection test error", { error: error.message });
    return reply.code(500).send({
      success: false,
      message: "Failed to test connection",
      error: error.message,
    });
  }
};

/**
 * Validate Zoho credentials
 */
const validateZohoCredentials = async (request, reply) => {
  try {
    logger.info("Validating Zoho credentials");
    const isValid = await validateCredentials();

    if (isValid) {
      logger.info("Zoho credentials validated successfully");
    } else {
      logger.warn("Zoho credentials validation failed");
    }

    return reply.code(isValid ? 200 : 401).send({
      success: isValid,
      message: isValid
        ? "Credentials are valid"
        : "Invalid credentials or connection failed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Validate credentials error:", error);
    logger.error("Failed to validate Zoho credentials", {
      error: error.message,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to validate credentials",
      error: error.message,
    });
  }
};

// ============================================================================
// Invoice Operations
// ============================================================================

/**
 * Send single invoice to Zoho Books
 */
const sendInvoice = async (request, reply) => {
  try {
    // Debug: Log full request body
    console.log(
      "[ZOHO-CONTROLLER] Full request body:",
      JSON.stringify(request.body, null, 2),
    );

    const { invoiceData, options = {} } = request.body;

    if (!invoiceData) {
      logger.warn("Send invoice request missing invoice data");
      console.log(
        "[ZOHO-CONTROLLER] Request body structure:",
        Object.keys(request.body),
      );
      return reply.code(400).send({
        success: false,
        error: "Invoice data is required in request body",
      });
    }

    const invoiceNumber = invoiceData.invoiceNumber || "N/A";
    console.log(`Sending invoice to Zoho: ${invoiceNumber}`);
    logger.info("Sending invoice to Zoho Books", {
      invoiceNumber,
      amount: invoiceData.totalAmount,
      customer: `${invoiceData.client?.firstName} ${invoiceData.client?.lastName}`,
    });

    // Debug: Log invoice data structure before validation
    console.log(
      "[ZOHO-CONTROLLER] Invoice data keys:",
      Object.keys(invoiceData),
    );
    console.log("[ZOHO-CONTROLLER] Invoice data sample:", {
      invoiceNumber: invoiceData.invoiceNumber,
      client: invoiceData.client,
      items: invoiceData.items,
      totalAmount: invoiceData.totalAmount,
      issueDate: invoiceData.issueDate,
      dueDate: invoiceData.dueDate,
    });

    // Validate invoice data
    const validation = validateInvoiceData(invoiceData);
    if (!validation.valid) {
      logger.warn("Invoice data validation failed", {
        invoiceNumber,
        errors: validation.errors,
      });
      console.log("[ZOHO-CONTROLLER] Validation errors:", validation.errors);
      console.log(
        "[ZOHO-CONTROLLER] Failed invoice data:",
        JSON.stringify(invoiceData, null, 2),
      );
      return reply.code(400).send({
        success: false,
        error: "Invalid invoice data",
        validationErrors: validation.errors,
      });
    }

    // Load facility-specific Zoho credentials before sending
    const facilityId =
      request.body?.facilityId ||
      request.query?.facilityId ||
      request.params?.facilityId;

    if (!facilityId) {
      logger.warn("Send invoice request missing facilityId");
      return reply.code(400).send({
        success: false,
        error: "facilityId is required to send invoice to Zoho",
      });
    }

    try {
      const ZohoIntegrationModel = await getModel(
        "ZohoIntegration",
        payservedb.ZohoIntegration.schema,
        facilityId,
      );

      const zohoCfg = await ZohoIntegrationModel.findOne({ facilityId });

      // If no config for this facility, do not add invoice to Zoho and return 0
      // If no config for this facility, fall back to hardcoded default credentials
      if (!zohoCfg) {
        logger.warn("No Zoho configuration found for facility - using default credentials", { facilityId });
        console.log(`[ZOHO-CONTROLLER] No DB config for facility ${facilityId} - applying hardcoded defaults`);

        ZOHO_CONFIG.clientId = '1000.85LKCF1P7LL243ZYNIIZZ8A2X3VZJY';
        ZOHO_CONFIG.clientSecret = '88b35138ce8a19182300666f7efe5e5169e83fafab';
        ZOHO_CONFIG.organizationId = '903422398';
        
        updateRefreshToken('1000.f985b8dca3c9c83f3ea3826fc779ca30.9c332a8807219068c419d23969982d7b');

        const { invalidateAccessToken } = require("../../../services/integrations/zoho/auth");
        invalidateAccessToken(); // Force fresh token fetch

        console.log('[ZOHO-CONTROLLER] Default credentials applied - proceeding with invoice sync');
      }
      // Decrypt sensitive credentials
      let decClientSecret = null;
      let decRefreshToken = null;
      let decAccessToken = null;

      try {
        decClientSecret = zohoCfg.clientSecret
          ? decrypt(zohoCfg.clientSecret)
          : null;
        decRefreshToken = zohoCfg.refreshToken
          ? decrypt(zohoCfg.refreshToken)
          : null;
        decAccessToken = zohoCfg.accessToken
          ? decrypt(zohoCfg.accessToken)
          : null;
      } catch (e) {
        logger.error("Failed to decrypt Zoho credentials", {
          facilityId,
          error: e.message,
        });
        return reply.code(500).send({
          success: false,
          error: "Failed to decrypt Zoho credentials for facility",
        });
      }

      // Apply facility credentials to runtime Zoho config used by services
      ZOHO_CONFIG.clientId = zohoCfg.clientId || ZOHO_CONFIG.clientId;
      ZOHO_CONFIG.clientSecret = decClientSecret || ZOHO_CONFIG.clientSecret;
      ZOHO_CONFIG.refreshToken = decRefreshToken || ZOHO_CONFIG.refreshToken;
      ZOHO_CONFIG.accessToken = decAccessToken || null;
      ZOHO_CONFIG.organizationId =
        zohoCfg.organizationId || ZOHO_CONFIG.organizationId;

      if (zohoCfg.requestTimeout) {
        ZOHO_CONFIG.requestTimeout = zohoCfg.requestTimeout;
      }
      if (typeof zohoCfg.maxRetries === "number") {
        ZOHO_CONFIG.maxRetries = zohoCfg.maxRetries;
      }

      logger.info("Applied facility-specific Zoho configuration", {
        facilityId,
        hasAccessToken: !!ZOHO_CONFIG.accessToken,
      });
      // Seed auth token store for this facility so authenticatedRequest can refresh/operate correctly
      if (decRefreshToken) {
        updateRefreshToken(decRefreshToken);
      }
      if (decAccessToken) {
        // Seed the current access token; authenticatedRequest will refresh when needed
        initializeTokenData(decAccessToken);
      }
    } catch (e) {
      logger.error("Failed to load facility Zoho configuration", {
        facilityId,
        error: e.message,
      });
      return reply.code(500).send({
        success: false,
        error: "Failed to load facility Zoho configuration",
      });
    }

    // Default options
    const syncOptions = {
      skipIfExists:
        options.skipIfExists !== undefined ? options.skipIfExists : true,
      recordPayment:
        options.recordPayment !== undefined ? options.recordPayment : true,
      markAsSent: options.markAsSent !== undefined ? options.markAsSent : true,
    };

    // Send to Zoho
    const result = await sendInvoiceToZoho(invoiceData, syncOptions);

    if (result.success) {
      logger.info("Invoice sent to Zoho successfully", {
        invoiceNumber,
        zohoInvoiceId: result.data.invoice?.id,
        skipped: result.skipped,
      });
    } else {
      logger.error("Failed to send invoice to Zoho", {
        invoiceNumber,
        error: result.message,
      });
    }

    return reply.code(result.success ? 200 : 400).send(result);
  } catch (error) {
    console.error("Send invoice error:", error);
    logger.error("Unexpected error sending invoice to Zoho", {
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to send invoice to Zoho Books",
      error: error.message,
    });
  }
};

/**
 * Send multiple invoices to Zoho Books (bulk operation)
 */
const bulkSendInvoices = async (request, reply) => {
  try {
    const {
      invoices,
      options = {},
      facilityId: globalFacilityId,
    } = request.body;

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      logger.warn("Bulk send request with invalid invoices array");
      return reply.code(400).send({
        success: false,
        error: "Invoices array is required and must not be empty",
      });
    }

    if (invoices.length > 100) {
      logger.warn("Bulk send request exceeds maximum limit", {
        count: invoices.length,
      });
      return reply.code(400).send({
        success: false,
        error: "Maximum 100 invoices can be sent at once",
      });
    }

    console.log(`Bulk sending ${invoices.length} invoices to Zoho...`);
    logger.info("Starting bulk invoice send to Zoho", {
      count: invoices.length,
    });

    const syncOptions = {
      skipIfExists:
        options.skipIfExists !== undefined ? options.skipIfExists : true,
      recordPayment:
        options.recordPayment !== undefined ? options.recordPayment : true,
      markAsSent: options.markAsSent !== undefined ? options.markAsSent : true,
    };

    // Per-invoice processing to apply facility-specific Zoho config
    const summary = {
      total: invoices.length,
      successful: 0,
      failed: 0,
      skipped: 0,
    };
    const detailedResults = [];

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const facilityId = inv.facilityId || globalFacilityId;

      // Require facilityId for each invoice
      if (!facilityId) {
        summary.failed++;
        detailedResults.push({
          index: i,
          invoiceNumber: inv?.invoiceNumber,
          result: {
            success: false,
            message: "facilityId is required for each invoice",
            error: "Missing facilityId",
          },
        });
        continue;
      }

      try {
        // Load facility-specific Zoho credentials
        const ZohoIntegrationModel = await getModel(
          "ZohoIntegration",
          payservedb.ZohoIntegration.schema,
          facilityId,
        );

        const zohoCfg = await ZohoIntegrationModel.findOne({ facilityId });

        // If config is missing, do not add to Zoho; mark as skipped with 0
        if (!zohoCfg) {
          summary.skipped++;
          detailedResults.push({
            index: i,
            invoiceNumber: inv?.invoiceNumber,
            result: 0,
          });
          continue;
        }

        // Decrypt sensitive fields
        let decClientSecret = null;
        let decRefreshToken = null;
        let decAccessToken = null;

        try {
          decClientSecret = zohoCfg.clientSecret
            ? decrypt(zohoCfg.clientSecret)
            : null;
          decRefreshToken = zohoCfg.refreshToken
            ? decrypt(zohoCfg.refreshToken)
            : null;
          decAccessToken = zohoCfg.accessToken
            ? decrypt(zohoCfg.accessToken)
            : null;
        } catch (e) {
          summary.failed++;
          detailedResults.push({
            index: i,
            invoiceNumber: inv?.invoiceNumber,
            result: {
              success: false,
              message: "Failed to decrypt Zoho credentials for facility",
              error: e.message,
            },
          });
          continue;
        }

        // Apply runtime Zoho config
        ZOHO_CONFIG.clientId = zohoCfg.clientId || ZOHO_CONFIG.clientId;
        ZOHO_CONFIG.clientSecret = decClientSecret || ZOHO_CONFIG.clientSecret;
        ZOHO_CONFIG.refreshToken = decRefreshToken || ZOHO_CONFIG.refreshToken;
        ZOHO_CONFIG.accessToken = decAccessToken || null;
        ZOHO_CONFIG.organizationId =
          zohoCfg.organizationId || ZOHO_CONFIG.organizationId;

        if (zohoCfg.requestTimeout) {
          ZOHO_CONFIG.requestTimeout = zohoCfg.requestTimeout;
        }
        if (typeof zohoCfg.maxRetries === "number") {
          ZOHO_CONFIG.maxRetries = zohoCfg.maxRetries;
        }

        // Seed auth token store for this facility
        if (decRefreshToken) {
          updateRefreshToken(decRefreshToken);
        }
        if (decAccessToken) {
          initializeTokenData(decAccessToken);
        }
        // Send single invoice with current facility config
        const singleResult = await sendInvoiceToZoho(inv, syncOptions);

        if (singleResult?.success) {
          if (singleResult.skipped) summary.skipped++;
          else summary.successful++;
        } else {
          summary.failed++;
        }

        detailedResults.push({
          index: i,
          invoiceNumber: inv?.invoiceNumber,
          result: singleResult,
        });
      } catch (e) {
        summary.failed++;
        detailedResults.push({
          index: i,
          invoiceNumber: inv?.invoiceNumber,
          result: {
            success: false,
            message: e.message || "Failed to process invoice",
            error: e.message || e,
          },
        });
      }
    }

    logger.info("Bulk invoice send completed", {
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      skipped: summary.skipped,
    });

    return reply.code(200).send({
      success: true,
      message: "Bulk send completed",
      summary: {
        total: summary.total,
        successful: summary.successful,
        failed: summary.failed,
        skipped: summary.skipped,
      },
      results: detailedResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Bulk send error:", error);
    logger.error("Bulk invoice send error", {
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to bulk send invoices",
      error: error.message,
    });
  }
};

/**
 * Get invoice status from Zoho Books
 */
const getInvoiceStatus = async (request, reply) => {
  try {
    const { identifier } = request.params;
    const { type = "number" } = request.query;

    if (!identifier) {
      logger.warn("Get invoice status request missing identifier");
      return reply.code(400).send({
        success: false,
        error: "Invoice identifier is required",
      });
    }

    console.log(`Getting invoice status from Zoho (${type}): ${identifier}`);
    logger.info("Getting invoice status from Zoho", { identifier, type });

    let invoice;

    if (type === "id") {
      // Get by Zoho invoice ID
      invoice = await getInvoiceById(identifier);
    } else {
      // Search by invoice number
      const invoices = await searchInvoiceByNumber(identifier);
      invoice = invoices && invoices.length > 0 ? invoices[0] : null;
    }

    if (!invoice) {
      logger.info("Invoice not found in Zoho Books", { identifier, type });
      return reply.code(404).send({
        success: false,
        message: "Invoice not found in Zoho Books",
      });
    }

    logger.info("Invoice status retrieved from Zoho", {
      identifier,
      zohoInvoiceId: invoice.invoice_id,
      status: invoice.status,
    });

    return reply.code(200).send({
      success: true,
      message: "Invoice found in Zoho Books",
      data: {
        zohoInvoiceId: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        status: invoice.status,
        total: invoice.total,
        balance: invoice.balance,
        currency: invoice.currency_code,
        date: invoice.date,
        dueDate: invoice.due_date,
        paymentMade: invoice.payment_made,
        invoiceUrl: invoice.invoice_url,
      },
    });
  } catch (error) {
    console.error("Get invoice status error:", error);
    logger.error("Failed to get invoice status from Zoho", {
      error: error.message,
      identifier: req.params.identifier,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to get invoice status from Zoho",
      error: error.message,
    });
  }
};

/**
 * Mark invoice as sent in Zoho
 */
const markInvoiceSent = async (request, reply) => {
  try {
    const { zohoInvoiceId } = request.body;

    if (!zohoInvoiceId) {
      return reply.code(400).send({
        success: false,
        error: "Zoho invoice ID is required",
      });
    }

    console.log(`Marking invoice as sent in Zoho: ${zohoInvoiceId}`);

    const success = await markInvoiceAsSent(zohoInvoiceId);

    if (success) {
      return reply.code(200).send({
        success: true,
        message: "Invoice marked as sent in Zoho Books",
        data: { zohoInvoiceId },
      });
    } else {
      return reply.code(400).send({
        success: false,
        message: "Failed to mark invoice as sent",
      });
    }
  } catch (error) {
    console.error("Mark invoice sent error:", error);
    return reply.code(500).send({
      success: false,
      message: "Failed to mark invoice as sent",
      error: error.message,
    });
  }
};

// ============================================================================
// Invoice Operations - Get by Number
// ============================================================================

/**
 * Get Zoho invoice(s) by invoice number
 * Query param: invoiceNumber (required)
 * Example: GET /api/integrations/zoho/invoices/by-number?invoiceNumber=INV-2025-001
 */
const getInvoiceByNumber = async (request, reply) => {
  try {
    const { invoiceNumber, facilityId } = request.query;

    if (!invoiceNumber) {
      logger.warn("Get invoice by number request missing invoiceNumber");
      return reply.code(400).send({
        success: false,
        error: "invoiceNumber query parameter is required",
      });
    }

    // Load facility-specific Zoho credentials if facilityId provided
    if (facilityId) {
      const credResult = await loadFacilityZohoCredentials(facilityId);
      if (!credResult.success) {
        logger.warn(
          "Failed to load facility Zoho credentials for getInvoiceByNumber",
          {
            facilityId,
            error: credResult.error,
          },
        );
        return reply.code(400).send({
          success: false,
          error: credResult.error,
        });
      }
    }

    console.log(`Searching Zoho invoice by number: ${invoiceNumber}`);
    logger.info("Searching Zoho invoice by number", {
      invoiceNumber,
      facilityId,
    });

    const invoices = await searchInvoiceByNumber(invoiceNumber);

    if (!invoices || invoices.length === 0) {
      logger.info("Invoice not found in Zoho Books", { invoiceNumber });
      return reply.code(404).send({
        success: false,
        message: "Invoice not found",
      });
    }

    const results = invoices.map((inv) => ({
      id: inv.invoice_id || inv.id,
      number: inv.invoice_number || inv.invoiceNumber,
      date: inv.date || inv.issueDate,
      dueDate: inv.due_date || inv.dueDate,
      total: inv.total,
      balance: inv.balance,
      status: inv.status,
      currency: inv.currency_code || inv.currencyCode,
      customerId: inv.customer_id || inv.customerId,
      customerName: inv.customer_name || inv.customerName,
      url: inv.invoice_url || inv.url,
    }));

    return reply.code(200).send({
      success: true,
      invoices: results,
      count: results.length,
    });
  } catch (error) {
    console.error("Get invoice by number error:", error);
    logger.error("Failed to get invoice by number from Zoho", {
      error: error.message,
    });
    return reply.code(500).send({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

// ============================================================================
// Payment Operations - Record by Invoice Number
// ============================================================================
/**
 * Record payment for an invoice using its invoice number
 * Body:
 * {
 *   "invoiceNumber": "TESTNEW002",
 *   "amount": 16000,
 *   "paymentDate": "2025-10-22",        // optional, defaults to today
 *   "paymentMode": "mpesa",             // mpesa | cash | check | bank_transfer | creditcard
 *   "referenceNumber": "TJ96G6WZNE",    // optional, or use "transactionId"
 *   "transactionId": "TJ96G6WZNE",      // optional
 *   "description": "Payment via M-Pesa" // optional
 * }
 */
const recordPaymentByInvoiceNumber = async (request, reply) => {
  try {
    const {
      facilityId,
      invoiceNumber,
      amount,
      paymentDate,
      paymentMode = "cash",
      referenceNumber,
      transactionId,
      description,
    } = request.body;

    if (!invoiceNumber || !amount) {
      logger.warn("Record payment by invoice number missing required fields");
      return reply.code(400).send({
        success: false,
        error: "invoiceNumber and amount are required",
      });
    }

    // Load facility-specific Zoho credentials
    if (facilityId) {
      const credResult = await loadFacilityZohoCredentials(facilityId);
      if (!credResult.success) {
        logger.warn(
          "Failed to load facility Zoho credentials for recordPaymentByInvoiceNumber",
          {
            facilityId,
            error: credResult.error,
          },
        );
        return reply.code(400).send({
          success: false,
          error: credResult.error,
        });
      }
    } else {
      logger.warn(
        "recordPaymentByInvoiceNumber called without facilityId - using env credentials",
      );
    }

    console.log(`Recording payment by invoice number: ${invoiceNumber}`);
    logger.info("Recording payment by invoice number", {
      invoiceNumber,
      amount,
      paymentMode,
      facilityId,
    });

    // Find Zoho invoice by number
    const invoices = await searchInvoiceByNumber(invoiceNumber);
    if (!invoices || invoices.length === 0) {
      logger.info("Invoice not found in Zoho Books", { invoiceNumber });
      return reply.code(404).send({
        success: false,
        message: "Invoice not found in Zoho Books",
      });
    }

    const invoice = invoices[0];
    const zohoInvoiceId = invoice.invoice_id;
    let zohoCustomerId = invoice.customer_id;

    // If customer_id is not present in the list payload, fetch full invoice
    if (!zohoCustomerId && zohoInvoiceId) {
      const full = await getInvoiceById(zohoInvoiceId);
      zohoCustomerId = full?.customer_id;
    }

    if (!zohoInvoiceId || !zohoCustomerId) {
      logger.error("Missing Zoho invoice or customer id", {
        zohoInvoiceId,
        zohoCustomerId,
      });
      return reply.code(500).send({
        success: false,
        message: "Unable to resolve Zoho invoice or customer for payment",
      });
    }

    // Normalize payment date (YYYY-MM-DD)
    const formattedDate = paymentDate
      ? new Date(paymentDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Normalize payment mode to Zoho-accepted values
    const normalizePaymentMode = (mode) => {
      const m = (mode || "cash").toLowerCase().replace(/[\s\-_]/g, "");
      if (m.includes("mpesa") || m.includes("mpes")) return "mpesa";
      if (m.includes("bank") || m.includes("transfer")) return "bank_transfer";
      if (m.includes("card") || m.includes("credit") || m.includes("debit"))
        return "creditcard";
      if (m.includes("cheque") || m.includes("check")) return "check";
      if (m.includes("cash")) return "cash";
      return "cash";
    };

    const normalizedMode = normalizePaymentMode(paymentMode);
    const ref = referenceNumber || transactionId || `PAY-${Date.now()}`;

    // Use addPaymentToInvoice which handles overpayments automatically
    const paymentInfo = {
      invoiceId: zohoInvoiceId,
      customerId: zohoCustomerId,
      amount: parseFloat(amount),
      paymentDate: formattedDate,
      paymentMode: normalizedMode,
      referenceNumber: ref,
      description: description || `Payment for invoice ${invoiceNumber}`,
    };

    const result = await addPaymentToInvoice(paymentInfo);

    logger.info("Payment recorded by invoice number successfully", {
      invoiceNumber,
      zohoInvoiceId,
      paymentId: result.data.payment.id,
      amount: result.data.payment.amount,
      overpayment: result.data.customerCredit ? true : false,
      creditAmount: result.data.customerCredit?.amount || 0,
    });

    return reply.code(200).send({
      success: true,
      message: result.message,
      data: {
        invoiceNumber,
        zohoInvoiceId,
        payment: result.data.payment,
        invoice: result.data.invoice,
        customerCredit: result.data.customerCredit || null,
        overpaymentAmount: result.data.overpaymentAmount || 0,
      },
    });
  } catch (error) {
    console.error("Record payment by invoice number error:", error);
    logger.error("Failed to record payment by invoice number in Zoho", {
      error: error.message || error,
      invoiceNumber: request.body?.invoiceNumber,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to record payment in Zoho Books",
      error: error.message || error,
    });
  }
};
// ============================================================================
// Payment Operations
// ============================================================================

/**
 * Record payment for invoice in Zoho Books
 */
const recordPayment = async (request, reply) => {
  try {
    const {
      zohoInvoiceId,
      zohoCustomerId,
      amount,
      paymentDate,
      paymentMode = "mpesa",
      transactionId,
      description,
    } = request.body;

    if (!zohoInvoiceId || !zohoCustomerId || !amount) {
      logger.warn("Record payment request missing required fields");
      return reply.code(400).send({
        success: false,
        error: "Zoho invoice ID, customer ID, and amount are required",
      });
    }

    console.log(`Recording payment for invoice ${zohoInvoiceId} in Zoho`);
    logger.info("Recording payment in Zoho", {
      zohoInvoiceId,
      zohoCustomerId,
      amount,
      paymentMode,
    });

    // Format date
    const formattedDate = paymentDate
      ? new Date(paymentDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Prepare payment data
    const paymentData = {
      customerId: zohoCustomerId,
      amount: parseFloat(amount),
      date: formattedDate,
      paymentMode: paymentMode,
      referenceNumber: transactionId || `PAY-${Date.now()}`,
      description: description || `Payment for invoice`,
      invoices: [
        {
          invoiceId: zohoInvoiceId,
          amountApplied: parseFloat(amount),
        },
      ],
    };

    const payment = await createPayment(paymentData);

    logger.info("Payment recorded successfully in Zoho", {
      paymentId: payment.payment_id,
      zohoInvoiceId,
      amount: payment.amount,
    });

    return reply.code(200).send({
      success: true,
      message: "Payment recorded successfully in Zoho Books",
      data: {
        paymentId: payment.payment_id,
        amount: payment.amount,
        reference: payment.reference_number,
        date: payment.date,
        zohoInvoiceId,
      },
    });
  } catch (error) {
    console.error("Record payment error:", error);
    logger.error("Failed to record payment in Zoho", {
      error: error.message || error,
      zohoInvoiceId: req.body.zohoInvoiceId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to record payment in Zoho Books",
      error: error.message || error,
    });
  }
};

/**
 * Mark invoice as paid in Zoho Books
 * This combines payment recording with invoice update
 */
const markInvoicePaid = async (request, reply) => {
  try {
    const {
      invoiceData,
      zohoInvoiceId,
      zohoCustomerId,
      amount,
      paymentDate,
      paymentMode = "mpesa",
      transactionId,
    } = request.body;

    // Validate required fields
    if (!zohoInvoiceId || !zohoCustomerId) {
      logger.warn("Mark invoice paid request missing required fields");
      return reply.code(400).send({
        success: false,
        error: "Zoho invoice ID and customer ID are required",
      });
    }

    const paymentAmount = amount || invoiceData?.totalAmount;

    if (!paymentAmount) {
      logger.warn("Mark invoice paid request missing payment amount");
      return reply.code(400).send({
        success: false,
        error: "Payment amount is required",
      });
    }

    console.log(`Marking invoice ${zohoInvoiceId} as paid in Zoho`);
    logger.info("Marking invoice as paid in Zoho", {
      zohoInvoiceId,
      zohoCustomerId,
      amount: paymentAmount,
    });

    // Format date
    const formattedDate = paymentDate
      ? new Date(paymentDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Prepare payment data
    const paymentData = {
      customerId: zohoCustomerId,
      amount: parseFloat(paymentAmount),
      date: formattedDate,
      paymentMode: paymentMode,
      referenceNumber: transactionId || `PAY-${Date.now()}`,
      description: `Payment for invoice ${invoiceData?.invoiceNumber || zohoInvoiceId}`,
      invoices: [
        {
          invoiceId: zohoInvoiceId,
          amountApplied: parseFloat(paymentAmount),
        },
      ],
    };

    // Record payment
    const payment = await createPayment(paymentData);

    logger.info("Invoice marked as paid in Zoho successfully", {
      zohoInvoiceId,
      paymentId: payment.payment_id,
      amount: payment.amount,
    });

    return reply.code(200).send({
      success: true,
      message: "Invoice marked as paid in Zoho Books",
      data: {
        zohoInvoiceId,
        payment: {
          id: payment.payment_id,
          amount: payment.amount,
          reference: payment.reference_number,
          date: payment.date,
        },
      },
    });
  } catch (error) {
    console.error("Mark invoice paid error:", error);
    logger.error("Failed to mark invoice as paid in Zoho", {
      error: error.message || error,
      zohoInvoiceId: req.body.zohoInvoiceId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to mark invoice as paid in Zoho Books",
      error: error.message || error,
    });
  }
};

// ============================================================================
// Customer Operations
// ============================================================================

/**
 * Get customer from Zoho Books
 */
const getCustomer = async (request, reply) => {
  try {
    const { identifier } = request.params;
    const { type = "id" } = request.query;

    if (!identifier) {
      return reply.code(400).send({
        success: false,
        error: "Customer identifier is required",
      });
    }

    console.log(`Getting customer from Zoho (${type}): ${identifier}`);

    let customer;

    if (type === "id") {
      customer = await getCustomerById(identifier);
    } else {
      const customers = await searchCustomerByName(identifier);
      customer = customers && customers.length > 0 ? customers[0] : null;
    }

    if (!customer) {
      return reply.code(404).send({
        success: false,
        message: "Customer not found in Zoho Books",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Customer found in Zoho Books",
      data: {
        contactId: customer.contact_id,
        contactName: customer.contact_name,
        email: customer.email,
        phone: customer.phone,
        mobile: customer.mobile,
        currencyCode: customer.currency_code,
        outstandingAmount: customer.outstanding_receivable_amount,
        status: customer.status,
      },
    });
  } catch (error) {
    console.error("Get customer error:", error);
    return reply.code(500).send({
      success: false,
      message: "Failed to get customer from Zoho Books",
      error: error.message,
    });
  }
};

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get OAuth token status
 */
const getTokenInfo = async (request, reply) => {
  try {
    logger.info("Getting Zoho token status");
    const status = getTokenStatus();

    return reply.code(200).send({
      success: true,
      message: "Token status retrieved",
      data: {
        hasAccessToken: status.hasAccessToken,
        hasRefreshToken: status.hasRefreshToken,
        isExpired: status.isExpired,
        expiresAt: status.expiresAt,
        timeUntilExpiry: status.timeUntilExpiry,
        lastRefreshed: status.lastRefreshed,
      },
    });
  } catch (error) {
    console.error("Get token status error:", error);
    return reply.code(500).send({
      success: false,
      message: "Failed to get token status",
      error: error.message,
    });
  }
};

/**
 * Manually refresh OAuth token
 */
const refreshToken = async (request, reply) => {
  try {
    console.log("Manually refreshing Zoho OAuth token...");
    logger.info("Manually refreshing Zoho OAuth token");

    const newToken = await refreshAccessToken();

    logger.info("Zoho OAuth token refreshed successfully");

    return reply.code(200).send({
      success: true,
      message: "Token refreshed successfully",
      data: {
        tokenPreview: newToken.substring(0, 20) + "...",
        refreshedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    logger.error("Failed to refresh Zoho OAuth token", {
      error: error.message,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to refresh token",
      error: error.message,
    });
  }
};

// ============================================================================
// Advanced Payment Operations
// ============================================================================

/**
 * Add payment to an existing invoice
 * Supports partial and full payments
 */
const addPaymentToInvoiceController = async (request, reply) => {
  try {
    const paymentInfo = request.body;

    // Validate payment data
    const validation = validatePaymentData(paymentInfo);
    if (!validation.valid) {
      logger.warn("Payment data validation failed", {
        errors: validation.errors,
      });
      return reply.code(400).send({
        success: false,
        error: "Invalid payment data",
        details: validation.errors,
      });
    }

    console.log(`Adding payment to invoice ${paymentInfo.invoiceId} in Zoho`);
    logger.info("Adding payment to invoice", {
      invoiceId: paymentInfo.invoiceId,
      customerId: paymentInfo.customerId,
      amount: paymentInfo.amount,
      paymentMode: paymentInfo.paymentMode,
    });

    const result = await addPaymentToInvoice(paymentInfo);

    logger.info("Payment added to invoice successfully", {
      paymentId: result.data.payment.id,
      invoiceId: paymentInfo.invoiceId,
      amount: result.data.payment.amount,
      invoiceStatus: result.data.invoice.status,
    });

    return reply.code(200).send(result);
  } catch (error) {
    console.error("Add payment to invoice error:", error);
    logger.error("Failed to add payment to invoice", {
      error: error.message || error,
      invoiceId: request.body.invoiceId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to add payment to invoice",
      error: error.message || error,
    });
  }
};

/**
 * Add multiple payments to an invoice
 */
const addMultiplePaymentsController = async (request, reply) => {
  try {
    const { invoiceId, customerId, payments } = request.body;

    if (!invoiceId || !customerId || !payments || !Array.isArray(payments)) {
      logger.warn("Add multiple payments request missing required fields");
      return reply.code(400).send({
        success: false,
        error: "Invoice ID, customer ID, and payments array are required",
      });
    }

    console.log(
      `Adding ${payments.length} payments to invoice ${invoiceId} in Zoho`,
    );
    logger.info("Adding multiple payments to invoice", {
      invoiceId,
      customerId,
      paymentCount: payments.length,
    });

    const results = await addMultiplePayments(invoiceId, customerId, payments);

    logger.info("Multiple payments added", {
      invoiceId,
      total: results.total,
      successful: results.successful,
      failed: results.failed,
    });

    return reply.code(200).send({
      success: results.success,
      message: `Batch payment complete: ${results.successful} successful, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    console.error("Add multiple payments error:", error);
    logger.error("Failed to add multiple payments", {
      error: error.message || error,
      invoiceId: request.body.invoiceId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to add multiple payments",
      error: error.message || error,
    });
  }
};

/**
 * Get all payments for a specific invoice
 */
const getInvoicePaymentsController = async (request, reply) => {
  try {
    const { invoiceId } = request.params;

    if (!invoiceId) {
      logger.warn("Get invoice payments request missing invoice ID");
      return reply.code(400).send({
        success: false,
        error: "Invoice ID is required",
      });
    }

    console.log(`Getting payments for invoice ${invoiceId} from Zoho`);
    logger.info("Getting invoice payments", { invoiceId });

    const payments = await getInvoicePaymentsList(invoiceId);

    logger.info("Invoice payments retrieved", {
      invoiceId,
      paymentCount: payments.length,
    });

    return reply.code(200).send({
      success: true,
      message: `Found ${payments.length} payment(s) for invoice`,
      data: {
        invoiceId,
        paymentCount: payments.length,
        payments,
      },
    });
  } catch (error) {
    console.error("Get invoice payments error:", error);
    logger.error("Failed to get invoice payments", {
      error: error.message || error,
      invoiceId: request.params.invoiceId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to get invoice payments",
      error: error.message || error,
    });
  }
};

/**
 * Get payment history summary for an invoice
 */
const getPaymentHistoryController = async (request, reply) => {
  try {
    const { invoiceId } = request.params;

    if (!invoiceId) {
      logger.warn("Get payment history request missing invoice ID");
      return reply.code(400).send({
        success: false,
        error: "Invoice ID is required",
      });
    }

    console.log(`Getting payment history for invoice ${invoiceId} from Zoho`);
    logger.info("Getting payment history", { invoiceId });

    const history = await getPaymentHistory(invoiceId);

    logger.info("Payment history retrieved", {
      invoiceId,
      totalPayments: history.paymentSummary.totalPayments,
      totalPaid: history.paymentSummary.totalAmountPaid,
      status: history.invoice.status,
    });

    return reply.code(200).send({
      success: true,
      message: "Payment history retrieved successfully",
      data: history,
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    logger.error("Failed to get payment history", {
      error: error.message || error,
      invoiceId: request.params.invoiceId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to get payment history",
      error: error.message || error,
    });
  }
};

/**
 * Delete a payment from Zoho Books
 */
const deletePaymentController = async (request, reply) => {
  try {
    const { paymentId } = request.params;

    if (!paymentId) {
      logger.warn("Delete payment request missing payment ID");
      return reply.code(400).send({
        success: false,
        error: "Payment ID is required",
      });
    }

    console.log(`Deleting payment ${paymentId} from Zoho`);
    logger.info("Deleting payment", { paymentId });

    const result = await removePayment(paymentId);

    logger.info("Payment deleted successfully", { paymentId });

    return reply.code(200).send(result);
  } catch (error) {
    console.error("Delete payment error:", error);
    logger.error("Failed to delete payment", {
      error: error.message || error,
      paymentId: request.params.paymentId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to delete payment",
      error: error.message || error,
    });
  }
};

/**
 * Update payment details
 */
const updatePaymentController = async (request, reply) => {
  try {
    const { paymentId } = request.params;
    const updates = request.body;

    if (!paymentId) {
      logger.warn("Update payment request missing payment ID");
      return reply.code(400).send({
        success: false,
        error: "Payment ID is required",
      });
    }

    console.log(`Updating payment ${paymentId} in Zoho`);
    logger.info("Updating payment", { paymentId, updates });

    const payment = await modifyPayment(paymentId, updates);

    logger.info("Payment updated successfully", {
      paymentId: payment.payment_id,
      paymentNumber: payment.payment_number,
    });

    return reply.code(200).send({
      success: true,
      message: "Payment updated successfully",
      data: {
        paymentId: payment.payment_id,
        paymentNumber: payment.payment_number,
        amount: payment.amount,
        date: payment.date,
      },
    });
  } catch (error) {
    console.error("Update payment error:", error);
    logger.error("Failed to update payment", {
      error: error.message || error,
      paymentId: request.params.paymentId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to update payment",
      error: error.message || error,
    });
  }
};

/**
 * Get available payment modes
 */
const getPaymentModesController = async (request, reply) => {
  try {
    console.log("Getting available payment modes");
    logger.info("Getting payment modes");

    const paymentModes = getPaymentModes();

    return reply.code(200).send({
      success: true,
      message: "Payment modes retrieved successfully",
      data: {
        paymentModes,
        count: paymentModes.length,
      },
    });
  } catch (error) {
    console.error("Get payment modes error:", error);
    logger.error("Failed to get payment modes", {
      error: error.message || error,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to get payment modes",
      error: error.message || error,
    });
  }
};

/**
 * Create customer credit (standalone payment not applied to any invoice)
 */
// ============================================================================
// Payment Operations - Record Payment for Account (Multiple Invoices)
// ============================================================================
/**
 * Record payment for an account, distributing across all unpaid invoices
 * This handles the PayServe BBF logic by finding ALL unpaid Zoho invoices
 * for a customer and allocating payment oldest-first
 *
 * Body:
 * {
 *   "facilityId": "68354b430bfa0b7ac72078c5",
 *   "accountNumber": "6668838",
 *   "customerId": "7253014000000237001",  // Zoho customer ID (optional if accountNumber provided)
 *   "totalPayment": 90000,
 *   "paymentDate": "2025-12-02",
 *   "paymentMode": "cash",
 *   "referenceNumber": "CASH-abc123",
 *   "description": "Payment for account"
 * }
 */
const recordPaymentForAccount = async (request, reply) => {
  try {
    const {
      facilityId,
      accountNumber,
      customerId: providedCustomerId,
      totalPayment,
      paymentDate,
      paymentMode = "cash",
      referenceNumber,
      description,
    } = request.body;

    if (!totalPayment || totalPayment <= 0) {
      return reply.code(400).send({
        success: false,
        error: "totalPayment must be a positive number",
      });
    }

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: "facilityId is required",
      });
    }

    // Load facility-specific Zoho credentials
    const credResult = await loadFacilityZohoCredentials(facilityId);
    if (!credResult.success) {
      return reply.code(400).send({
        success: false,
        error: credResult.error,
      });
    }

    console.log(
      `\n====================================================================================================`,
    );
    console.log(`[ZOHO-ACCOUNT-PAYMENT] 🚀 Recording payment for account`);
    console.log(
      `====================================================================================================`,
    );
    console.log(`[ZOHO-ACCOUNT-PAYMENT] Facility ID: ${facilityId}`);
    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] Account Number: ${accountNumber || "N/A"}`,
    );
    console.log(`[ZOHO-ACCOUNT-PAYMENT] Total Payment: ${totalPayment}`);
    console.log(`[ZOHO-ACCOUNT-PAYMENT] Payment Mode: ${paymentMode}`);
    console.log(
      `====================================================================================================`,
    );

    let zohoCustomerId = providedCustomerId;

    // If no customer ID provided, try to find it from account number
    if (!zohoCustomerId && accountNumber) {
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT] 🔍 Looking up customer by account number: ${accountNumber}`,
      );

      // Search for invoices with this reference number (account number)
      const {
        listInvoices,
      } = require("../../../services/integrations/zoho/invoice");

      // Use referenceNumber filter to find invoices for this account
      const invoicesResponse = await listInvoices({
        referenceNumber: accountNumber,
        perPage: 100,
      });

      if (invoicesResponse.invoices && invoicesResponse.invoices.length > 0) {
        // Get customer ID from the first matching invoice
        const matchingInvoice = invoicesResponse.invoices[0];
        zohoCustomerId = matchingInvoice.customer_id;
        console.log(
          `[ZOHO-ACCOUNT-PAYMENT] ✅ Found customer ID: ${zohoCustomerId} from ${invoicesResponse.invoices.length} invoice(s)`,
        );
      }
    }

    if (!zohoCustomerId) {
      return reply.code(400).send({
        success: false,
        error:
          "Could not determine Zoho customer ID. Provide customerId or valid accountNumber.",
      });
    }

    // Step 1: Get ALL invoices with balance > 0 for this account from Zoho
    console.log(
      `\n[ZOHO-ACCOUNT-PAYMENT] 📋 STEP 1: Fetching all invoices with outstanding balance`,
    );
    const {
      listInvoices,
    } = require("../../../services/integrations/zoho/invoice");

    // Fetch invoices by reference number (account number) if provided
    // Otherwise fetch by customer ID
    let allInvoices = [];

    if (accountNumber) {
      // Direct search by reference number is most accurate
      const byRefResponse = await listInvoices({
        referenceNumber: accountNumber,
        perPage: 100,
      });
      allInvoices = byRefResponse.invoices || [];
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT] Found ${allInvoices.length} invoice(s) for account ${accountNumber}`,
      );
    } else {
      // Fallback to customer ID search
      const byCustomerResponse = await listInvoices({
        customerId: zohoCustomerId,
        perPage: 100,
      });
      allInvoices = byCustomerResponse.invoices || [];
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT] Found ${allInvoices.length} invoice(s) for customer ${zohoCustomerId}`,
      );
    }

    // Filter to only invoices with balance > 0 (unpaid or partially paid)
    let unpaidInvoices = allInvoices.filter((inv) => {
      const balance = parseFloat(inv.balance || 0);
      return balance > 0;
    });

    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] ${unpaidInvoices.length} invoice(s) have outstanding balance`,
    );

    // Sort by date (oldest first) to apply FIFO payment allocation
    unpaidInvoices.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] Found ${unpaidInvoices.length} unpaid invoice(s)`,
    );

    if (unpaidInvoices.length === 0) {
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT] ⚠️  No unpaid invoices found - recording as customer credit`,
      );

      // Create customer credit for the full amount
      const {
        createPayment,
      } = require("../../../services/integrations/zoho/payment");
      const creditPayment = await createPayment({
        customerId: zohoCustomerId,
        amount: totalPayment,
        date: paymentDate || new Date().toISOString().split("T")[0],
        paymentMode: paymentMode,
        referenceNumber: `${referenceNumber || "PAY"}-CREDIT`,
        description:
          description || `Customer credit - Account ${accountNumber}`,
        invoices: [], // No invoices = customer credit
      });

      return reply.code(200).send({
        success: true,
        message:
          "No unpaid invoices found. Full amount recorded as customer credit.",
        data: {
          totalPayment,
          invoicesPaid: 0,
          totalAppliedToInvoices: 0,
          customerCredit: totalPayment,
          creditPaymentId: creditPayment?.payment_id,
        },
      });
    }

    // Log unpaid invoices
    let totalUnpaidBalance = 0;
    unpaidInvoices.forEach((inv, idx) => {
      const balance = parseFloat(inv.balance || inv.total || 0);
      totalUnpaidBalance += balance;
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT]    ${idx + 1}. ${inv.invoice_number} - Balance: ${balance} (Date: ${inv.date})`,
      );
    });
    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] Total unpaid balance: ${totalUnpaidBalance}`,
    );

    // Step 2: Allocate payment across invoices (oldest first)
    console.log(
      `\n[ZOHO-ACCOUNT-PAYMENT] 📋 STEP 2: Allocating payment across invoices`,
    );

    let remainingPayment = totalPayment;
    const paymentAllocations = [];
    const paymentResults = [];

    const {
      createPayment,
    } = require("../../../services/integrations/zoho/payment");

    const formattedDate = paymentDate
      ? new Date(paymentDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Normalize payment mode
    const normalizePaymentMode = (mode) => {
      const m = (mode || "cash").toLowerCase().replace(/[\s\-_]/g, "");
      if (m.includes("mpesa") || m.includes("mpes")) return "mpesa";
      if (m.includes("bank") || m.includes("transfer")) return "bank_transfer";
      if (m.includes("card") || m.includes("credit") || m.includes("debit"))
        return "creditcard";
      if (m.includes("cheque") || m.includes("check")) return "check";
      return "cash";
    };
    const normalizedMode = normalizePaymentMode(paymentMode);

    for (const invoice of unpaidInvoices) {
      if (remainingPayment <= 0) break;

      const invoiceBalance = parseFloat(invoice.balance || invoice.total || 0);
      if (invoiceBalance <= 0) continue;

      const amountToApply = Math.min(remainingPayment, invoiceBalance);

      console.log(
        `\n[ZOHO-ACCOUNT-PAYMENT] 💳 Applying payment to invoice: ${invoice.invoice_number}`,
      );
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT]    Invoice Balance: ${invoiceBalance}`,
      );
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT]    Amount to Apply: ${amountToApply}`,
      );
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT]    Remaining Payment: ${remainingPayment}`,
      );

      try {
        // Create payment for this invoice
        const payment = await createPayment({
          customerId: zohoCustomerId,
          amount: amountToApply,
          date: formattedDate,
          paymentMode: normalizedMode,
          referenceNumber: referenceNumber || `PAY-${Date.now()}`,
          description:
            description || `Payment for invoice ${invoice.invoice_number}`,
          invoices: [
            {
              invoiceId: invoice.invoice_id,
              amountApplied: amountToApply,
            },
          ],
        });

        paymentAllocations.push({
          invoiceId: invoice.invoice_id,
          invoiceNumber: invoice.invoice_number,
          amountApplied: amountToApply,
          previousBalance: invoiceBalance,
          newBalance: invoiceBalance - amountToApply,
          paymentId: payment?.payment_id,
        });

        paymentResults.push({
          invoiceNumber: invoice.invoice_number,
          success: true,
          amountApplied: amountToApply,
          paymentId: payment?.payment_id,
        });

        console.log(
          `[ZOHO-ACCOUNT-PAYMENT]    ✅ Payment recorded - Payment ID: ${payment?.payment_id}`,
        );

        remainingPayment -= amountToApply;
      } catch (paymentError) {
        console.error(
          `[ZOHO-ACCOUNT-PAYMENT]    ❌ Failed to record payment: ${paymentError.message}`,
        );
        paymentResults.push({
          invoiceNumber: invoice.invoice_number,
          success: false,
          error: paymentError.message,
        });
      }
    }

    // Step 3: Handle overpayment (remaining amount as customer credit)
    let customerCreditResult = null;
    if (remainingPayment > 0) {
      console.log(
        `\n[ZOHO-ACCOUNT-PAYMENT] 📋 STEP 3: Recording overpayment as customer credit`,
      );
      console.log(
        `[ZOHO-ACCOUNT-PAYMENT] Overpayment Amount: ${remainingPayment}`,
      );

      try {
        const creditPayment = await createPayment({
          customerId: zohoCustomerId,
          amount: remainingPayment,
          date: formattedDate,
          paymentMode: normalizedMode,
          referenceNumber: `${referenceNumber || "PAY"}-CREDIT-${Date.now().toString(36)}`,
          description: `Overpayment credit - Account ${accountNumber || "N/A"}`,
          notes: `Overpayment from total payment of ${totalPayment}. Applied ${totalPayment - remainingPayment} to invoices.`,
          invoices: [], // No invoices = customer credit
        });

        customerCreditResult = {
          amount: remainingPayment,
          paymentId: creditPayment?.payment_id,
          paymentNumber: creditPayment?.payment_number,
        };

        console.log(
          `[ZOHO-ACCOUNT-PAYMENT] ✅ Customer credit created: ${remainingPayment}`,
        );
        console.log(
          `[ZOHO-ACCOUNT-PAYMENT]    Credit Payment ID: ${creditPayment?.payment_id}`,
        );
      } catch (creditError) {
        console.error(
          `[ZOHO-ACCOUNT-PAYMENT] ❌ Failed to create customer credit: ${creditError.message}`,
        );
        customerCreditResult = {
          amount: remainingPayment,
          error: creditError.message,
        };
      }
    }

    // Summary
    const totalAppliedToInvoices = paymentAllocations.reduce(
      (sum, a) => sum + a.amountApplied,
      0,
    );
    const invoicesPaidFully = paymentAllocations.filter(
      (a) => a.newBalance <= 0,
    ).length;
    const invoicesPaidPartially = paymentAllocations.filter(
      (a) => a.newBalance > 0,
    ).length;

    console.log(
      `\n====================================================================================================`,
    );
    console.log(`[ZOHO-ACCOUNT-PAYMENT] 🎉 PAYMENT RECORDING COMPLETED`);
    console.log(
      `====================================================================================================`,
    );
    console.log(`[ZOHO-ACCOUNT-PAYMENT] Total Payment: ${totalPayment}`);
    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] Applied to Invoices: ${totalAppliedToInvoices}`,
    );
    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] Invoices Fully Paid: ${invoicesPaidFully}`,
    );
    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] Invoices Partially Paid: ${invoicesPaidPartially}`,
    );
    console.log(
      `[ZOHO-ACCOUNT-PAYMENT] Customer Credit (Overpayment): ${remainingPayment}`,
    );
    console.log(
      `====================================================================================================\n`,
    );

    return reply.code(200).send({
      success: true,
      message: `Payment of ${totalPayment} recorded successfully`,
      data: {
        totalPayment,
        totalAppliedToInvoices,
        invoicesPaidFully,
        invoicesPaidPartially,
        customerCredit: remainingPayment,
        customerCreditResult,
        allocations: paymentAllocations,
        results: paymentResults,
      },
    });
  } catch (error) {
    console.error("[ZOHO-ACCOUNT-PAYMENT] ❌ Error:", error);
    logger.error("Failed to record payment for account", {
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to record payment for account",
      error: error.message,
    });
  }
};

const createCustomerCreditController = async (request, reply) => {
  try {
    const {
      facilityId,
      customerId,
      amount,
      paymentDate,
      paymentMode = "cash",
      referenceNumber,
      description,
      notes,
    } = request.body;

    if (!customerId || !amount) {
      logger.warn("Create customer credit missing required fields");
      return reply.code(400).send({
        success: false,
        error: "customerId and amount are required",
      });
    }

    // Load facility-specific Zoho credentials
    if (facilityId) {
      const credResult = await loadFacilityZohoCredentials(facilityId);
      if (!credResult.success) {
        logger.warn(
          "Failed to load facility Zoho credentials for createCustomerCredit",
          {
            facilityId,
            error: credResult.error,
          },
        );
        return reply.code(400).send({
          success: false,
          error: credResult.error,
        });
      }
    } else {
      logger.warn(
        "createCustomerCreditController called without facilityId - using env credentials",
      );
    }

    console.log(
      `Creating customer credit for customer ${customerId}: ${amount}`,
    );
    logger.info("Creating customer credit", {
      customerId,
      amount,
      paymentMode,
      facilityId,
    });

    // Format payment date
    const formattedDate = paymentDate
      ? new Date(paymentDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Create payment with empty invoices array = customer credit
    const paymentData = {
      customerId,
      amount: parseFloat(amount),
      date: formattedDate,
      paymentMode,
      referenceNumber: referenceNumber || `CREDIT-${Date.now()}`,
      description: description || `Customer credit`,
      notes: notes || `Overpayment credit - available for future invoices`,
      invoices: [], // Empty array creates customer credit
    };

    const payment = await createPayment(paymentData);

    logger.info("Customer credit created successfully", {
      paymentId: payment.payment_id,
      customerId,
      amount: payment.amount,
    });

    return reply.code(200).send({
      success: true,
      message: "Customer credit created successfully",
      data: {
        payment,
        creditAmount: payment.amount,
      },
    });
  } catch (error) {
    console.error("Create customer credit error:", error);
    logger.error("Failed to create customer credit", {
      error: error.message || error,
      customerId: request.body?.customerId,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to create customer credit",
      error: error.message || error,
    });
  }
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Connection
  testConnection,
  validateZohoCredentials,

  // Invoice Operations
  sendInvoice,
  bulkSendInvoices,
  getInvoiceStatus,
  getInvoiceByNumber,
  markInvoiceSent,

  // Payment Operations
  recordPayment,
  recordPaymentByInvoiceNumber,
  recordPaymentForAccount,
  markInvoicePaid,

  // Advanced Payment Operations
  addPaymentToInvoiceController,
  addMultiplePaymentsController,
  getInvoicePaymentsController,
  getPaymentHistoryController,
  deletePaymentController,
  updatePaymentController,
  getPaymentModesController,
  createCustomerCreditController,

  // Customer Operations
  getCustomer,

  // Token Management
  getTokenInfo,
  refreshToken,
};
