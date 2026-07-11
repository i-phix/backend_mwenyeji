const addInvoicePayment = require("./add_invoice_payment");
const cancelInvoicePayment = require("./cancel_invoice_payment");
const getInvoicePayments = require("./get_invoice_payments");
const getPayment = require("./get_payment");
const updatePayment = require("./update_payment");

module.exports = {
  addInvoicePayment,
  cancelInvoicePayment,
  getInvoicePayments,
  getPayment,
  updatePayment,
};
