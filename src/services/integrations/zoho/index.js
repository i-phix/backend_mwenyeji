/**
 * Zoho Books Integration - Main Export
 *
 * This is the main entry point for the Zoho Books integration.
 * Import what you need from this file.
 *
 * @example
 * // Import main function
 * const { sendInvoiceToZoho } = require('./services/integrations/zoho');
 *
 * @example
 * // Import specific modules
 * const { customer, invoice, payment } = require('./services/integrations/zoho');
 */

// Main functions
const {
  sendInvoiceToZoho,
  bulkSendInvoicesToZoho,
  testZohoConnection,
  validateInvoiceData,
} = require("./send_invoice");

// Auth module
const auth = require("./auth");
const {
  getValidAccessToken,
  refreshAccessToken,
  authenticatedRequest,
  validateCredentials,
  getTokenStatus,
} = auth;

// Customer module
const customer = require("./customer");
const {
  getOrCreateCustomer,
  searchCustomerByName,
  getCustomerById,
  createCustomer,
  updateCustomer,
  listCustomers,
  mapInvoiceClientToZohoCustomer,
} = customer;

// Invoice module
const invoice = require("./invoice");
const {
  createInvoice,
  getInvoiceById,
  searchInvoiceByNumber,
  listInvoices,
  updateInvoice,
  deleteInvoice,
  markInvoiceAsSent,
  voidInvoice,
  mapInvoiceToZohoFormat,
  checkInvoiceExists,
} = invoice;

// Payment module
const payment = require("./payment");
const {
  createPayment,
  getPaymentById,
  listPayments,
  updatePayment,
  deletePayment,
  getInvoicePayments,
  recordInvoicePayment,
  mapPaymentToZohoFormat,
} = payment;

// Auto Credit Application module
const autoCreditApplication = require("./auto_credit_application");
const {
  autoApplyCreditsToNewInvoice,
  getAvailableCustomerCredits,
  applyCreditToInvoice,
  isEligibleForAutoCreditApplication,
} = autoCreditApplication;

// Config
const { ZOHO_CONFIG, getConfig, validateConfig } = require("./config");

// Utils
const utils = require("./utils");
const {
  formatDate,
  formatAmount,
  formatCurrency,
  sanitizeString,
  buildFullName,
  parseZohoError,
  extractErrorMessage,
} = utils;

/**
 * Main exports - Most commonly used functions
 */
module.exports = {
  // Primary functions
  sendInvoiceToZoho,
  bulkSendInvoicesToZoho,
  testZohoConnection,
  validateInvoiceData,

  // Module exports
  auth,
  customer,
  invoice,
  payment,
  autoCreditApplication,
  utils,

  // Commonly used individual functions
  getValidAccessToken,
  refreshAccessToken,
  getOrCreateCustomer,
  createInvoice,
  createPayment,
  autoApplyCreditsToNewInvoice,
  isEligibleForAutoCreditApplication,

  // Config
  ZOHO_CONFIG,
  getConfig,
  validateConfig,

  // Commonly used utils
  formatDate,
  formatAmount,
  formatCurrency,
};

/**
 * Named exports for easier destructuring
 */
module.exports.ZohoBooks = {
  // Main operations
  sendInvoice: sendInvoiceToZoho,
  bulkSendInvoices: bulkSendInvoicesToZoho,
  testConnection: testZohoConnection,

  // Module APIs
  customers: {
    getOrCreate: getOrCreateCustomer,
    search: searchCustomerByName,
    getById: getCustomerById,
    create: createCustomer,
    update: updateCustomer,
    list: listCustomers,
  },

  invoices: {
    create: createInvoice,
    getById: getInvoiceById,
    search: searchInvoiceByNumber,
    list: listInvoices,
    update: updateInvoice,
    delete: deleteInvoice,
    markAsSent: markInvoiceAsSent,
    void: voidInvoice,
    checkExists: checkInvoiceExists,
  },

  payments: {
    create: createPayment,
    getById: getPaymentById,
    list: listPayments,
    update: updatePayment,
    delete: deletePayment,
    getInvoicePayments: getInvoicePayments,
    recordInvoicePayment: recordInvoicePayment,
  },

  auth: {
    getToken: getValidAccessToken,
    refreshToken: refreshAccessToken,
    validate: validateCredentials,
    getStatus: getTokenStatus,
  },

  utils: {
    formatDate,
    formatAmount,
    formatCurrency,
    sanitizeString,
    buildFullName,
    parseError: parseZohoError,
    extractErrorMessage,
  },
};
