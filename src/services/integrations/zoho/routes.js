/**
 * Zoho Books Integration - Express Routes
 *
 * This file contains all API endpoints for Zoho Books integration.
 *
 * Available Endpoints:
 * - POST   /api/zoho/test-connection       - Test Zoho connection
 * - POST   /api/zoho/invoices/send         - Send single invoice to Zoho
 * - POST   /api/zoho/invoices/bulk-send    - Send multiple invoices to Zoho
 * - POST   /api/zoho/invoices/:id/send     - Send specific invoice by ID
 * - POST   /api/zoho/invoices/:id/payment  - Record payment for invoice
 * - PUT    /api/zoho/invoices/:id/mark-paid - Mark invoice as paid in Zoho
 * - GET    /api/zoho/invoices/:id/status   - Get invoice status from Zoho
 * - POST   /api/zoho/invoices/:id/resync   - Re-sync invoice to Zoho
 * - GET    /api/zoho/customers/:id         - Get customer from Zoho
 * - POST   /api/zoho/sync/all-unpaid       - Sync all unpaid invoices
 * - GET    /api/zoho/token/status          - Get OAuth token status
 * - POST   /api/zoho/token/refresh         - Manually refresh token
 */

const express = require("express");
const router = express.Router();

// Import Zoho integration modules
const {
  sendInvoiceToZoho,
  bulkSendInvoicesToZoho,
  testZohoConnection,
  validateInvoiceData,
} = require("./send_invoice");

const { getTokenStatus, refreshAccessToken } = require("./auth");
const { getInvoiceById, searchInvoiceByNumber } = require("./invoice");
const { createPayment, recordInvoicePayment } = require("./payment");
const { getCustomerById } = require("./customer");

// ============================================================================
// Middleware
// ============================================================================

/**
 * Authentication middleware (customize based on your auth system)
 */
const authenticate = (req, res, next) => {
  // TODO: Implement your authentication logic
  // Example:
  // if (!req.user || !req.user.id) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }
  next();
};

/**
 * Validate invoice ID parameter
 */
const validateInvoiceId = (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Invoice ID is required",
    });
  }

  next();
};

/**
 * Request logging middleware
 */
const logRequest = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
};

// Apply middleware to all routes
router.use(logRequest);
// router.use(authenticate); // Uncomment when auth is implemented

// ============================================================================
// Health Check & Connection Test
// ============================================================================

/**
 * Test Zoho Books connection
 *
 * @route POST /api/zoho/test-connection
 * @returns {Object} Connection status
 */
router.post("/test-connection", async (req, res) => {
  try {
    const result = await testZohoConnection();

    const statusCode = result.success ? 200 : 503;
    return res.status(statusCode).json(result);
  } catch (error) {
    console.error("Connection test error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to test connection",
      error: error.message,
    });
  }
});

// ============================================================================
// Invoice Operations
// ============================================================================

/**
 * Send invoice to Zoho Books
 *
 * @route POST /api/zoho/invoices/send
 * @body {Object} invoiceData - Invoice data from your system
 * @body {Object} options - Sync options (skipIfExists, recordPayment, markAsSent)
 * @returns {Object} Sync result with invoice details
 *
 * @example
 * POST /api/zoho/invoices/send
 * {
 *   "invoiceData": {
 *     "invoiceNumber": "INV-001",
 *     "client": { "firstName": "John", "lastName": "Doe" },
 *     "items": [...],
 *     "totalAmount": 1000,
 *     ...
 *   },
 *   "options": {
 *     "skipIfExists": true,
 *     "recordPayment": true,
 *     "markAsSent": true
 *   }
 * }
 */
router.post("/invoices/send", async (req, res) => {
  try {
    const { invoiceData, options = {} } = req.body;

    if (!invoiceData) {
      return res.status(400).json({
        success: false,
        error: "Invoice data is required",
      });
    }

    // Validate invoice data
    const validation = validateInvoiceData(invoiceData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid invoice data",
        details: validation.errors,
      });
    }

    // Send to Zoho
    const result = await sendInvoiceToZoho(invoiceData, options);

    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (error) {
    console.error("Send invoice error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send invoice to Zoho",
      error: error.message,
    });
  }
});

/**
 * Send specific invoice by database ID
 *
 * @route POST /api/zoho/invoices/:id/send
 * @param {string} id - Invoice ID from your database
 * @body {Object} options - Sync options
 * @returns {Object} Sync result
 *
 * @example
 * POST /api/zoho/invoices/68e7752ce44602bff0e8594b/send
 * {
 *   "options": {
 *     "skipIfExists": true,
 *     "recordPayment": true,
 *     "markAsSent": true
 *   }
 * }
 */
router.post("/invoices/:id/send", validateInvoiceId, async (req, res) => {
  try {
    const { id } = req.params;
    const { options = {} } = req.body;

    // TODO: Replace with your database query
    // const invoice = await Invoice.findById(id);

    // For now, return error if invoice not found in request
    const invoiceData = req.body.invoiceData;

    if (!invoiceData) {
      return res.status(400).json({
        success: false,
        error:
          "Invoice data is required in request body or fetch from database",
      });
    }

    // Send to Zoho
    const result = await sendInvoiceToZoho(invoiceData, options);

    if (result.success) {
      // TODO: Update your database with Zoho details
      // await Invoice.findByIdAndUpdate(id, {
      //   zohoInvoiceId: result.data.invoice.id,
      //   zohoInvoiceNumber: result.data.invoice.number,
      //   zohoSyncedAt: new Date(),
      //   zohoSyncStatus: 'synced'
      // });

      return res.status(200).json({
        success: true,
        message: "Invoice sent to Zoho successfully",
        data: result.data,
        invoiceId: id,
      });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Send invoice by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send invoice to Zoho",
      error: error.message,
    });
  }
});

/**
 * Bulk send multiple invoices to Zoho
 *
 * @route POST /api/zoho/invoices/bulk-send
 * @body {Array} invoices - Array of invoice data
 * @body {Object} options - Sync options
 * @returns {Object} Bulk sync results
 *
 * @example
 * POST /api/zoho/invoices/bulk-send
 * {
 *   "invoices": [
 *     { "invoiceNumber": "INV-001", ... },
 *     { "invoiceNumber": "INV-002", ... }
 *   ],
 *   "options": {
 *     "skipIfExists": true,
 *     "recordPayment": true
 *   }
 * }
 */
router.post("/invoices/bulk-send", async (req, res) => {
  try {
    const { invoices, options = {} } = req.body;

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invoices array is required and must not be empty",
      });
    }

    if (invoices.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Maximum 50 invoices can be sent at once",
      });
    }

    // Bulk send
    const results = await bulkSendInvoicesToZoho(invoices, options);

    return res.status(200).json({
      success: true,
      message: "Bulk send completed",
      summary: {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        skipped: results.skipped,
      },
      results: results.results,
    });
  } catch (error) {
    console.error("Bulk send error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bulk send invoices",
      error: error.message,
    });
  }
});

/**
 * Re-sync invoice to Zoho (useful for failed syncs)
 *
 * @route POST /api/zoho/invoices/:id/resync
 * @param {string} id - Invoice ID
 * @returns {Object} Sync result
 */
router.post("/invoices/:id/resync", validateInvoiceId, async (req, res) => {
  try {
    const { id } = req.params;
    const invoiceData = req.body.invoiceData;

    if (!invoiceData) {
      return res.status(400).json({
        success: false,
        error: "Invoice data is required",
      });
    }

    // Force re-sync by setting skipIfExists to false
    const result = await sendInvoiceToZoho(invoiceData, {
      skipIfExists: false,
      recordPayment: true,
      markAsSent: true,
    });

    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (error) {
    console.error("Resync error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resync invoice",
      error: error.message,
    });
  }
});

/**
 * Get invoice status from Zoho
 *
 * @route GET /api/zoho/invoices/:id/status
 * @param {string} id - Invoice ID or invoice number
 * @query {string} type - 'id' or 'number' (default: 'id')
 * @returns {Object} Invoice details from Zoho
 *
 * @example
 * GET /api/zoho/invoices/7253014000000113050/status?type=id
 * GET /api/zoho/invoices/LSE251009278/status?type=number
 */
router.get("/invoices/:id/status", validateInvoiceId, async (req, res) => {
  try {
    const { id } = req.params;
    const { type = "id" } = req.query;

    let invoice;

    if (type === "number") {
      // Search by invoice number
      const invoices = await searchInvoiceByNumber(id);
      invoice = invoices && invoices.length > 0 ? invoices[0] : null;
    } else {
      // Get by Zoho invoice ID
      invoice = await getInvoiceById(id);
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found in Zoho Books",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invoice found",
      data: {
        invoice_id: invoice.invoice_id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        status: invoice.status,
        total: invoice.total,
        balance: invoice.balance,
        currency_code: invoice.currency_code,
        date: invoice.date,
        due_date: invoice.due_date,
        payment_made: invoice.payment_made,
        invoice_url: invoice.invoice_url,
      },
    });
  } catch (error) {
    console.error("Get invoice status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get invoice status",
      error: error.message,
    });
  }
});

// ============================================================================
// Payment Operations
// ============================================================================

/**
 * Record payment for invoice in Zoho
 *
 * @route POST /api/zoho/invoices/:id/payment
 * @param {string} id - Zoho invoice ID
 * @body {Object} paymentData - Payment details
 * @returns {Object} Payment result
 *
 * @example
 * POST /api/zoho/invoices/7253014000000113050/payment
 * {
 *   "customerId": "7253014000000113002",
 *   "amount": 16000,
 *   "date": "2025-10-22",
 *   "paymentMode": "mpesa",
 *   "referenceNumber": "TJ96G6WZNE",
 *   "description": "MPESA payment"
 * }
 */
router.post("/invoices/:id/payment", validateInvoiceId, async (req, res) => {
  try {
    const { id: invoiceId } = req.params;
    const paymentData = req.body;

    if (!paymentData.customerId || !paymentData.amount) {
      return res.status(400).json({
        success: false,
        error: "Customer ID and amount are required",
      });
    }

    // Add invoice to payment data
    paymentData.invoices = [
      {
        invoiceId: invoiceId,
        amountApplied: paymentData.amount,
      },
    ];

    // Create payment
    const payment = await createPayment(paymentData);

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        payment_id: payment.payment_id,
        amount: payment.amount,
        reference_number: payment.reference_number,
        date: payment.date,
      },
    });
  } catch (error) {
    console.error("Record payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record payment",
      error: error.message || error,
    });
  }
});

/**
 * Mark invoice as paid in Zoho
 *
 * @route PUT /api/zoho/invoices/:id/mark-paid
 * @param {string} id - Invoice ID from your database or Zoho invoice ID
 * @body {Object} paymentDetails - Payment information
 * @returns {Object} Result with updated invoice status
 *
 * @example
 * PUT /api/zoho/invoices/68e7752ce44602bff0e8594b/mark-paid
 * {
 *   "zohoInvoiceId": "7253014000000113050",
 *   "zohoCustomerId": "7253014000000113002",
 *   "amount": 16000,
 *   "paymentDate": "2025-10-22",
 *   "paymentMode": "mpesa",
 *   "transactionId": "TJ96G6WZNE",
 *   "description": "MPESA payment for invoice"
 * }
 */
router.put("/invoices/:id/mark-paid", validateInvoiceId, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      zohoInvoiceId,
      zohoCustomerId,
      amount,
      paymentDate,
      paymentMode = "mpesa",
      transactionId,
      description,
    } = req.body;

    if (!zohoInvoiceId || !zohoCustomerId || !amount) {
      return res.status(400).json({
        success: false,
        error: "Zoho invoice ID, customer ID, and amount are required",
      });
    }

    // Format payment date
    const formattedDate = paymentDate
      ? new Date(paymentDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Prepare payment data
    const paymentData = {
      customerId: zohoCustomerId,
      amount: amount,
      date: formattedDate,
      paymentMode: paymentMode,
      referenceNumber: transactionId || `PAY-${Date.now()}`,
      description: description || `Payment for invoice`,
      invoices: [
        {
          invoiceId: zohoInvoiceId,
          amountApplied: amount,
        },
      ],
    };

    // Record payment in Zoho
    const payment = await createPayment(paymentData);

    // TODO: Update your database
    // await Invoice.findByIdAndUpdate(id, {
    //   status: 'Paid',
    //   amountPaid: amount,
    //   zohoPaymentId: payment.payment_id,
    //   paymentDate: formattedDate
    // });

    return res.status(200).json({
      success: true,
      message: "Invoice marked as paid in Zoho",
      data: {
        invoiceId: id,
        zohoInvoiceId: zohoInvoiceId,
        payment: {
          id: payment.payment_id,
          amount: payment.amount,
          reference: payment.reference_number,
          date: payment.date,
        },
      },
    });
  } catch (error) {
    console.error("Mark as paid error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark invoice as paid",
      error: error.message || error,
    });
  }
});

// ============================================================================
// Bulk Sync Operations
// ============================================================================

/**
 * Sync all unpaid invoices to Zoho
 *
 * @route POST /api/zoho/sync/all-unpaid
 * @query {number} limit - Maximum number of invoices to sync (default: 50)
 * @returns {Object} Sync summary
 */
router.post("/sync/all-unpaid", async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // TODO: Replace with your database query
    // const invoices = await Invoice.find({
    //   status: { $in: ['Unpaid', 'Partially Paid'] },
    //   zohoInvoiceId: null
    // }).limit(parseInt(limit));

    // For now, return info message
    return res.status(200).json({
      success: true,
      message: "To implement: Query unpaid invoices from database and sync",
      instructions: "Replace the TODO comment with your database query",
    });

    // Uncomment when database query is ready:
    // const results = await bulkSendInvoicesToZoho(
    //   invoices.map(inv => inv.toJSON()),
    //   {
    //     skipIfExists: true,
    //     recordPayment: false,
    //     markAsSent: true
    //   }
    // );
    //
    // return res.status(200).json({
    //   success: true,
    //   message: 'Sync completed',
    //   summary: {
    //     total: results.total,
    //     successful: results.successful,
    //     failed: results.failed,
    //     skipped: results.skipped
    //   }
    // });
  } catch (error) {
    console.error("Sync all unpaid error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync unpaid invoices",
      error: error.message,
    });
  }
});

// ============================================================================
// Customer Operations
// ============================================================================

/**
 * Get customer from Zoho by ID
 *
 * @route GET /api/zoho/customers/:id
 * @param {string} id - Zoho customer ID
 * @returns {Object} Customer details
 */
router.get("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await getCustomerById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in Zoho Books",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer found",
      data: {
        contact_id: customer.contact_id,
        contact_name: customer.contact_name,
        email: customer.email,
        phone: customer.phone,
        currency_code: customer.currency_code,
        outstanding_receivable_amount: customer.outstanding_receivable_amount,
        status: customer.status,
      },
    });
  } catch (error) {
    console.error("Get customer error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get customer",
      error: error.message,
    });
  }
});

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get OAuth token status
 *
 * @route GET /api/zoho/token/status
 * @returns {Object} Token status details
 */
router.get("/token/status", async (req, res) => {
  try {
    const status = getTokenStatus();

    return res.status(200).json({
      success: true,
      message: "Token status retrieved",
      data: status,
    });
  } catch (error) {
    console.error("Get token status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get token status",
      error: error.message,
    });
  }
});

/**
 * Manually refresh OAuth token
 *
 * @route POST /api/zoho/token/refresh
 * @returns {Object} New token details
 */
router.post("/token/refresh", async (req, res) => {
  try {
    const newToken = await refreshAccessToken();

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        access_token: newToken.substring(0, 20) + "...", // Masked for security
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh token",
      error: error.message,
    });
  }
});

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Global error handler for this router
 */
router.use((error, req, res, next) => {
  console.error("Zoho routes error:", error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? error : undefined,
  });
});

module.exports = router;
