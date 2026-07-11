const add_settings = require("./facility_billing/invoice/settings/add_settings");
const edit_settings = require("./facility_billing/invoice/settings/edit_settings");
const delete_settings = require("./facility_billing/invoice/settings/delete_settings");
const get_settings = require("./facility_billing/invoice/settings/get_settings");

// Company data controllers
const get_company_data = require("./company/get_company_data");
const get_company_by_facility = require("./company/get_company_by_facility");
const get_active_units_for_facility = require("./facility_billing/get_active_units_for_facility");

const {
  addRecipient,
  deleteRecipient,
  updateRecipient,
  getFacilityRecipients,
} = require("./facility_billing/invoice/settings/facility_recipient");
const uploadContractDocument = require("./facility_billing/documents/uploadContractDocument");
const {
  addFacilityPricing,
  editFacilityPricing,
  getFacilityPricing,
  deleteFacilityPricing,
} = require("./facility_billing/invoice/settings/facility_pricing");

// Invoice generation controllers
const generateInvoice = require("./facility_billing/invoice/generate_invoice");
const manageCronStatus = require("./facility_billing/invoice/cron_status");

// Invoice management controllers
const getInvoice = require("./facility_billing/invoice/get_invoice");
const getInvoices = require("./facility_billing/invoice/get_invoices");
const editInvoice = require("./facility_billing/invoice/edit_invoice");
const getBalanceSummary = require("./facility_billing/invoice/get_balance_summary");
const recalculateBalances = require("./facility_billing/invoice/recalculate_balances");
const getFinancialSummary = require("./facility_billing/invoice/get_financial_summary");

// Invoice payment controllers
const {
  addInvoicePayment,
  cancelInvoicePayment,
  getInvoicePayments,
  getPayment,
  updatePayment,
} = require("./facility_billing/invoice/invoice_payment");

// Import multer for file uploads
const multer = require("fastify-multer");

// Configure multer for contract document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

async function registerRoutes(fastify) {
  const billingBaseRoutes = "/api/core/billing";

  // Routes for billing settings
  fastify.get(`${billingBaseRoutes}/settings`, get_settings);

  fastify.post(`${billingBaseRoutes}/settings`, add_settings);

  fastify.put(`${billingBaseRoutes}/settings`, edit_settings);

  fastify.delete(`${billingBaseRoutes}/settings`, delete_settings);

  // Routes for company data
  fastify.get(`${billingBaseRoutes}/company/data`, get_company_data);
  fastify.get(
    `${billingBaseRoutes}/company/facility/:facilityId`,
    get_company_by_facility,
  );
  // Route for facility units
  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/units`,
    get_active_units_for_facility,
  );

  // Routes for facility recipients
  fastify.post(
    `${billingBaseRoutes}/facility/:facilityId/recipients`,
    addRecipient,
  );

  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/recipients`,
    getFacilityRecipients,
  );

  fastify.put(
    `${billingBaseRoutes}/facility/:facilityId/recipients/:recipientId`,
    updateRecipient,
  );

  fastify.delete(
    `${billingBaseRoutes}/facility/:facilityId/recipients/:recipientId`,
    deleteRecipient,
  );

  // Contract document upload endpoint with multer middleware
  fastify.post(
    `${billingBaseRoutes}/contracts/:contractId/upload-document`,
    { preHandler: upload.single("file") },
    uploadContractDocument,
  );

  // Facility pricing routes
  fastify.post(
    `${billingBaseRoutes}/facility/:facilityId/pricing`,
    addFacilityPricing,
  );

  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/pricing`,
    getFacilityPricing,
  );

  fastify.put(
    `${billingBaseRoutes}/facility/:facilityId/pricing`,
    editFacilityPricing,
  );

  fastify.delete(
    `${billingBaseRoutes}/facility/:facilityId/pricing`,
    deleteFacilityPricing,
  );

  // Invoice generation routes
  fastify.post(`${billingBaseRoutes}/generate-invoice`, generateInvoice);

  fastify.post(
    `${billingBaseRoutes}/facility/:facilityId/generate-invoice`,
    generateInvoice,
  );

  fastify.post(`${billingBaseRoutes}/cron-status`, manageCronStatus);

  // Invoice management routes
  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/invoices`,
    getInvoices,
  );

  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/invoices/:invoiceId`,
    getInvoice,
  );

  fastify.put(
    `${billingBaseRoutes}/facility/:facilityId/invoices/:invoiceId`,
    editInvoice,
  );

  // Balance summary route
  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/balance-summary`,
    getBalanceSummary,
  );

  // Manual balance recalculation route
  fastify.post(
    `${billingBaseRoutes}/facility/:facilityId/recalculate-balances`,
    recalculateBalances,
  );

  // Financial summary route
  fastify.get(`${billingBaseRoutes}/financial-summary`, getFinancialSummary);

  // Invoice payment routes
  // Add a new payment
  fastify.post(
    `${billingBaseRoutes}/facility/:facilityId/invoices/:invoiceId/payments`,
    addInvoicePayment,
  );

  // Get all payments for an invoice
  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/invoices/:invoiceId/payments`,
    getInvoicePayments,
  );

  // Get a specific payment
  fastify.get(
    `${billingBaseRoutes}/facility/:facilityId/invoices/:invoiceId/payments/:paymentId`,
    getPayment,
  );

  // Update a payment
  fastify.put(
    `${billingBaseRoutes}/facility/:facilityId/invoices/:invoiceId/payments/:paymentId`,
    updatePayment,
  );

  // Cancel/revert a payment
  fastify.delete(
    `${billingBaseRoutes}/facility/:facilityId/invoices/:invoiceId/payments/:paymentId`,
    cancelInvoicePayment,
  );
}

module.exports = { registerRoutes };
