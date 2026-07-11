/**
 * Zoho Books Integration Routes
 *
 * These routes handle integration with Zoho Books API
 * Base URL: /api/integrations/zoho
 * Note: These routes do NOT use JWT authentication as they are called by services
 */

// Import Zoho controller functions
const {
  testConnection,
  validateZohoCredentials,
  sendInvoice,
  bulkSendInvoices,
  getInvoiceStatus,
  getInvoiceByNumber,
  markInvoiceSent,
  recordPayment,
  recordPaymentByInvoiceNumber,
  recordPaymentForAccount,
  markInvoicePaid,
  getCustomer,
  getTokenInfo,
  refreshToken,
  // Advanced Payment Operations
  addPaymentToInvoiceController,
  addMultiplePaymentsController,
  getInvoicePaymentsController,
  getPaymentHistoryController,
  deletePaymentController,
  updatePaymentController,
  getPaymentModesController,
  createCustomerCreditController,
} = require("./zoho_controller");

/**
 * Register Zoho Books integration routes
 * @param {Express.Application} app - Express app instance
 */
async function registerRoutes(app) {
  console.log("Registering Zoho Books integration routes...");

  const baseRoute = "/api/integrations/zoho";

  // ============================================================================
  // Health Check & Connection Routes
  // ============================================================================

  /**
   * Test Zoho Books connection
   * POST /api/integrations/zoho/test-connection
   */
  app.post(`${baseRoute}/test-connection`, testConnection);

  /**
   * Validate Zoho credentials
   * POST /api/integrations/zoho/validate-credentials
   */
  app.post(`${baseRoute}/validate-credentials`, validateZohoCredentials);

  // ============================================================================
  // Invoice Routes
  // ============================================================================

  /**
   * Send single invoice to Zoho Books
   * POST /api/integrations/zoho/invoices/send
   *
   * Body (must include "facilityId" at top-level):
   * {
   *   "facilityId": "68354b430bfa0b7ac72078c5",
   *   "invoiceData": { ... },
   *   "options": {
   *     "skipIfExists": true,
   *     "recordPayment": true,
   *     "markAsSent": false
   *   }
   * }
   */
  app.post(`${baseRoute}/invoices/send`, sendInvoice);

  /**
   * Bulk send multiple invoices to Zoho Books
   * POST /api/integrations/zoho/invoices/bulk-send
   *
   * Body:
   * {
   *   "invoices": [...],
   *   "options": { ... }
   * }
   */
  app.post(`${baseRoute}/invoices/bulk-send`, bulkSendInvoices);

  /**
   * Get invoice status from Zoho Books
   * GET /api/integrations/zoho/invoices/:identifier/status
   *
   * Query params:
   * - type: 'id' or 'number' (default: 'number')
   */
  app.get(`${baseRoute}/invoices/:identifier/status`, getInvoiceStatus);
  /**
   * Get invoice(s) by invoice number
   * GET /api/integrations/zoho/invoices/by-number?invoiceNumber=INV-2025-001
   */
  app.get(`${baseRoute}/invoices/by-number`, getInvoiceByNumber);

  /**
   * Mark invoice as sent in Zoho Books
   * POST /api/integrations/zoho/invoices/mark-sent
   *
   * Body:
   * {
   *   "zohoInvoiceId": "..."
   * }
   */
  app.post(`${baseRoute}/invoices/mark-sent`, markInvoiceSent);

  // ============================================================================
  // Payment Routes
  // ============================================================================

  /**
   * Record payment for invoice in Zoho Books
   * POST /api/integrations/zoho/payments/record
   *
   * Body:
   * {
   *   "zohoInvoiceId": "...",
   *   "zohoCustomerId": "...",
   *   "amount": 1000,
   *   "paymentDate": "2025-10-22",
   *   "paymentMode": "mpesa",
   *   "transactionId": "TJ96G6WZNE",
   *   "description": "MPESA payment"
   * }
   */
  app.post(`${baseRoute}/payments/record`, recordPayment);
  app.post(
    `${baseRoute}/payments/record-by-number`,
    recordPaymentByInvoiceNumber,
  );

  /**
   * Record payment for an account (distributes across all unpaid invoices)
   * POST /api/integrations/zoho/payments/record-for-account
   *
   * Body:
   * {
   *   "facilityId": "68354b430bfa0b7ac72078c5",
   *   "accountNumber": "6668838",
   *   "customerId": "7253014000000237001",  // optional if accountNumber provided
   *   "totalPayment": 90000,
   *   "paymentDate": "2025-12-02",
   *   "paymentMode": "cash",
   *   "referenceNumber": "CASH-abc123",
   *   "description": "Payment for account"
   * }
   *
   * This handles PayServe's BBF logic by finding ALL unpaid Zoho invoices
   * for a customer and allocating payment oldest-first, with any
   * overpayment recorded as customer credit.
   */
  app.post(`${baseRoute}/payments/record-for-account`, recordPaymentForAccount);

  /**
   * Mark invoice as paid in Zoho Books
   * POST /api/integrations/zoho/invoices/mark-paid
   *
   * Body:
   * {
   *   "zohoInvoiceId": "...",
   *   "zohoCustomerId": "...",
   *   "amount": 1000,
   *   "paymentDate": "2025-10-22",
   *   "paymentMode": "mpesa",
   *   "transactionId": "TJ96G6WZNE",
   *   "invoiceData": { ... } (optional)
   * }
   */
  app.post(`${baseRoute}/invoices/mark-paid`, markInvoicePaid);

  // ============================================================================
  // Advanced Payment Routes
  // ============================================================================

  /**
   * Add payment to an existing invoice
   * POST /api/integrations/zoho/payments/add
   *
   * Body:
   * {
   *   "invoiceId": "7253014000000113050",
   *   "customerId": "7253014000000113002",
   *   "amount": 25000,
   *   "paymentDate": "2025-10-22",
   *   "paymentMode": "mpesa",
   *   "referenceNumber": "TJ96G6WZNE",
   *   "description": "Partial payment",
   *   "notes": "Payment via M-Pesa",
   *   "sendEmail": false
   * }
   */
  app.post(`${baseRoute}/payments/add`, addPaymentToInvoiceController);

  /**
   * Add multiple payments to an invoice
   * POST /api/integrations/zoho/payments/add-multiple
   *
   * Body:
   * {
   *   "invoiceId": "7253014000000113050",
   *   "customerId": "7253014000000113002",
   *   "payments": [
   *     {
   *       "amount": 10000,
   *       "paymentDate": "2025-10-15",
   *       "paymentMode": "mpesa",
   *       "referenceNumber": "TJ96G6WZNE"
   *     },
   *     {
   *       "amount": 15000,
   *       "paymentDate": "2025-10-20",
   *       "paymentMode": "bank_transfer",
   *       "referenceNumber": "BT123456"
   *     }
   *   ]
   * }
   */
  app.post(`${baseRoute}/payments/add-multiple`, addMultiplePaymentsController);

  /**
   * Get all payments for a specific invoice
   * GET /api/integrations/zoho/invoices/:invoiceId/payments
   */
  app.get(
    `${baseRoute}/invoices/:invoiceId/payments`,
    getInvoicePaymentsController,
  );

  /**
   * Get payment history summary for an invoice
   * GET /api/integrations/zoho/invoices/:invoiceId/payment-history
   */
  app.get(
    `${baseRoute}/invoices/:invoiceId/payment-history`,
    getPaymentHistoryController,
  );

  /**
   * Delete a payment
   * DELETE /api/integrations/zoho/payments/:paymentId
   */
  app.delete(`${baseRoute}/payments/:paymentId`, deletePaymentController);

  /**
   * Update payment details
   * PUT /api/integrations/zoho/payments/:paymentId
   *
   * Body:
   * {
   *   "amount": 30000,
   *   "date": "2025-10-23",
   *   "reference_number": "UPDATED-REF-123"
   * }
   */
  app.put(`${baseRoute}/payments/:paymentId`, updatePaymentController);

  /**
   * Get available payment modes
   * GET /api/integrations/zoho/payments/modes
   */
  app.get(`${baseRoute}/payments/modes`, getPaymentModesController);

  /**
   * Create customer credit (standalone payment not applied to invoice)
   * POST /api/integrations/zoho/payments/customer-credit
   *
   * Body:
   * {
   *   "customerId": "7253014000000113002",
   *   "amount": 20560,
   *   "paymentDate": "2025-11-20",
   *   "paymentMode": "cash",
   *   "referenceNumber": "CREDIT-12345",
   *   "description": "Overpayment credit from receipt CASH-ABC123",
   *   "notes": "Credit available for future invoices"
   * }
   */
  app.post(
    `${baseRoute}/payments/customer-credit`,
    createCustomerCreditController,
  );

  // ============================================================================
  // Customer Routes
  // ============================================================================

  /**
   * Get customer from Zoho Books
   * GET /api/integrations/zoho/customers/:identifier
   *
   * Query params:
   * - type: 'id' or 'name' (default: 'id')
   */
  app.get(`${baseRoute}/customers/:identifier`, getCustomer);

  // ============================================================================
  // Token Management Routes
  // ============================================================================

  /**
   * Get OAuth token status
   * GET /api/integrations/zoho/token/status
   */
  app.get(`${baseRoute}/token/status`, getTokenInfo);

  /**
   * Manually refresh OAuth token
   * POST /api/integrations/zoho/token/refresh
   */
  app.post(`${baseRoute}/token/refresh`, refreshToken);

  console.log("✅ Zoho Books integration routes registered successfully");
  console.log("   Base URL: /api/integrations/zoho");
  console.log("   - POST   /api/integrations/zoho/test-connection");
  console.log("   - POST   /api/integrations/zoho/validate-credentials");
  console.log("   - POST   /api/integrations/zoho/invoices/send");
  console.log("   - POST   /api/integrations/zoho/invoices/bulk-send");
  console.log("   - GET    /api/integrations/zoho/invoices/:identifier/status");
  console.log("   - GET    /api/integrations/zoho/invoices/by-number");
  console.log("   - POST   /api/integrations/zoho/invoices/mark-sent");
  console.log("   - POST   /api/integrations/zoho/invoices/mark-paid");
  console.log("   - POST   /api/integrations/zoho/payments/record");
  console.log("   - POST   /api/integrations/zoho/payments/record-by-number");
  console.log("   - POST   /api/integrations/zoho/payments/record-for-account");
  console.log("   - POST   /api/integrations/zoho/payments/add");
  console.log("   - POST   /api/integrations/zoho/payments/add-multiple");
  console.log(
    "   - GET    /api/integrations/zoho/invoices/:invoiceId/payments",
  );
  console.log(
    "   - GET    /api/integrations/zoho/invoices/:invoiceId/payment-history",
  );
  console.log("   - DELETE /api/integrations/zoho/payments/:paymentId");
  console.log("   - PUT    /api/integrations/zoho/payments/:paymentId");
  console.log("   - GET    /api/integrations/zoho/payments/modes");
  console.log("   - POST   /api/integrations/zoho/payments/customer-credit");
  console.log("   - GET    /api/integrations/zoho/customers/:identifier");
  console.log("   - GET    /api/integrations/zoho/token/status");
  console.log("   - POST   /api/integrations/zoho/token/refresh");
}

module.exports = { registerRoutes };
