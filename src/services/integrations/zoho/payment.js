/**
 * Zoho Books Payment Management Module
 * Handles customer payment operations
 */

const { authenticatedRequest } = require('./auth');
const { ZOHO_CONFIG } = require('./config');

/**
 * Create customer payment in Zoho Books
 * @param {Object} paymentData - Payment information
 * @param {string} paymentData.customerId - Zoho customer ID
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.date - Payment date (YYYY-MM-DD)
 * @param {string} paymentData.paymentMode - Payment method (cash, mpesa, bank_transfer, etc.)
 * @param {string} paymentData.referenceNumber - Transaction reference number
 * @param {string} paymentData.description - Payment description
 * @param {Array} paymentData.invoices - Array of invoices to apply payment to
 * @returns {Promise<Object>} Created payment details
 */
async function createPayment(paymentData) {
  try {
    const {
      customerId,
      amount,
      date,
      paymentMode = ZOHO_CONFIG.defaultPaymentMode,
      referenceNumber,
      description,
      invoices = [],
      notes
    } = paymentData;

    // Validate required fields
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    if (!amount || amount <= 0) {
      throw new Error('Valid payment amount is required');
    }
    if (!date) {
      throw new Error('Payment date is required');
    }

    console.log(`💰 Creating payment: ${amount} (${paymentMode})`);

    const requestBody = {
      customer_id: customerId,
      payment_mode: paymentMode,
      amount: amount,
      date: date
    };

    // Add optional fields
    if (referenceNumber) requestBody.reference_number = referenceNumber;
    if (description) requestBody.description = description;
    if (notes) requestBody.notes = notes;

    // Add invoices if provided
    if (invoices && invoices.length > 0) {
      requestBody.invoices = invoices.map(inv => ({
        invoice_id: inv.invoiceId,
        amount_applied: inv.amountApplied
      }));
    }

    const response = await authenticatedRequest({
      method: 'POST',
      url: ZOHO_CONFIG.endpoints.payments,
      data: requestBody
    });

    if (response.code === 0 && response.payment) {
      console.log(`✅ Payment created successfully: ${response.payment.payment_id}`);
      console.log(`   Amount: ${response.payment.amount}`);
      console.log(`   Reference: ${response.payment.reference_number || 'N/A'}`);
      return response.payment;
    }

    throw new Error('Failed to create payment - Invalid response');

  } catch (error) {
    console.error('❌ Error creating payment:', error.message);
    throw {
      message: 'Failed to create payment',
      originalError: error,
      code: 'PAYMENT_CREATE_FAILED'
    };
  }
}

/**
 * Get payment by ID
 * @param {string} paymentId - Zoho payment ID
 * @returns {Promise<Object>} Payment details
 */
async function getPaymentById(paymentId) {
  try {
    console.log(`🔍 Getting payment: ${paymentId}`);

    const response = await authenticatedRequest({
      method: 'GET',
      url: `${ZOHO_CONFIG.endpoints.payments}/${paymentId}`
    });

    if (response.code === 0 && response.payment) {
      console.log(`✅ Payment found: ${response.payment.payment_number}`);
      return response.payment;
    }

    return null;

  } catch (error) {
    console.error('❌ Error getting payment:', error.message);
    throw {
      message: 'Failed to get payment',
      originalError: error,
      code: 'PAYMENT_GET_FAILED'
    };
  }
}

/**
 * List payments for a customer or invoice
 * @param {Object} filters - Query filters
 * @param {string} filters.customerId - Filter by customer
 * @param {string} filters.invoiceId - Filter by invoice
 * @param {string} filters.dateStart - Filter by date range start
 * @param {string} filters.dateEnd - Filter by date range end
 * @param {number} filters.page - Page number
 * @param {number} filters.perPage - Results per page
 * @returns {Promise<Object>} Payments list with pagination
 */
async function listPayments(filters = {}) {
  try {
    const {
      customerId,
      invoiceId,
      dateStart,
      dateEnd,
      page = 1,
      perPage = 50
    } = filters;

    console.log(`📋 Fetching payments (page ${page})...`);

    const params = {
      page,
      per_page: perPage,
      sort_column: 'date',
      sort_order: 'D' // Descending
    };

    if (customerId) params.customer_id = customerId;
    if (dateStart) params.date_start = dateStart;
    if (dateEnd) params.date_end = dateEnd;

    const response = await authenticatedRequest({
      method: 'GET',
      url: ZOHO_CONFIG.endpoints.payments,
      params
    });

    if (response.code === 0) {
      return {
        payments: response.customerpayments || [],
        pageContext: response.page_context || {}
      };
    }

    return { payments: [], pageContext: {} };

  } catch (error) {
    console.error('❌ Error listing payments:', error.message);
    throw {
      message: 'Failed to list payments',
      originalError: error,
      code: 'PAYMENT_LIST_FAILED'
    };
  }
}

/**
 * Update payment
 * @param {string} paymentId - Zoho payment ID
 * @param {Object} paymentData - Payment data to update
 * @returns {Promise<Object>} Updated payment details
 */
async function updatePayment(paymentId, paymentData) {
  try {
    console.log(`📝 Updating payment: ${paymentId}`);

    const response = await authenticatedRequest({
      method: 'PUT',
      url: `${ZOHO_CONFIG.endpoints.payments}/${paymentId}`,
      data: paymentData
    });

    if (response.code === 0 && response.payment) {
      console.log(`✅ Payment updated successfully`);
      return response.payment;
    }

    throw new Error('Failed to update payment - Invalid response');

  } catch (error) {
    console.error('❌ Error updating payment:', error.message);
    throw {
      message: 'Failed to update payment',
      originalError: error,
      code: 'PAYMENT_UPDATE_FAILED'
    };
  }
}

/**
 * Delete payment
 * @param {string} paymentId - Zoho payment ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deletePayment(paymentId) {
  try {
    console.log(`🗑️  Deleting payment: ${paymentId}`);

    const response = await authenticatedRequest({
      method: 'DELETE',
      url: `${ZOHO_CONFIG.endpoints.payments}/${paymentId}`
    });

    if (response.code === 0) {
      console.log(`✅ Payment deleted successfully`);
      return true;
    }

    return false;

  } catch (error) {
    console.error('❌ Error deleting payment:', error.message);
    throw {
      message: 'Failed to delete payment',
      originalError: error,
      code: 'PAYMENT_DELETE_FAILED'
    };
  }
}

/**
 * Apply credit to invoice
 * @param {string} invoiceId - Zoho invoice ID
 * @param {Array} credits - Credits to apply
 * @returns {Promise<boolean>} True if applied successfully
 */
async function applyCreditsToInvoice(invoiceId, credits) {
  try {
    console.log(`💳 Applying credits to invoice: ${invoiceId}`);

    const requestBody = {
      invoice_payments: credits.filter(c => c.paymentId).map(c => ({
        payment_id: c.paymentId,
        amount_applied: c.amountApplied
      })),
      apply_creditnotes: credits.filter(c => c.creditnoteId).map(c => ({
        creditnote_id: c.creditnoteId,
        amount_applied: c.amountApplied
      }))
    };

    const response = await authenticatedRequest({
      method: 'POST',
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}/credits`,
      data: requestBody
    });

    if (response.code === 0) {
      console.log(`✅ Credits applied successfully`);
      return true;
    }

    return false;

  } catch (error) {
    console.error('❌ Error applying credits:', error.message);
    throw {
      message: 'Failed to apply credits',
      originalError: error,
      code: 'CREDITS_APPLY_FAILED'
    };
  }
}

/**
 * Get invoice payments
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<Array>} List of payments for the invoice
 */
async function getInvoicePayments(invoiceId) {
  try {
    console.log(`🔍 Getting payments for invoice: ${invoiceId}`);

    const response = await authenticatedRequest({
      method: 'GET',
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}/payments`
    });

    if (response.code === 0 && response.payments) {
      console.log(`✅ Found ${response.payments.length} payment(s)`);
      return response.payments;
    }

    return [];

  } catch (error) {
    console.error('❌ Error getting invoice payments:', error.message);
    throw {
      message: 'Failed to get invoice payments',
      originalError: error,
      code: 'INVOICE_PAYMENTS_GET_FAILED'
    };
  }
}

/**
 * Map payment data from your system to Zoho format
 * @param {Object} invoiceData - Invoice data from your system
 * @param {string} customerId - Zoho customer ID
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Object|null} Payment data formatted for Zoho, or null if not paid
 */
function mapPaymentToZohoFormat(invoiceData, customerId, invoiceId) {
  const {
    status,
    amountPaid,
    totalAmount,
    paymentDetails,
    reconciliationHistory
  } = invoiceData;

  // Check if invoice is paid or partially paid
  if (status !== 'Paid' && status !== 'Partially Paid') {
    return null;
  }

  if (!amountPaid || amountPaid <= 0) {
    return null;
  }

  // Format payment date
  const formatDate = (dateString) => {
    if (!dateString) return new Date().toISOString().split('T')[0];
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Get payment details
  const paymentDate = paymentDetails?.paymentDate ||
                      (reconciliationHistory && reconciliationHistory.length > 0
                        ? reconciliationHistory[0].date
                        : null);

  const paymentReference = paymentDetails?.transactionId ||
                           paymentDetails?.paymentReference ||
                           (reconciliationHistory && reconciliationHistory.length > 0
                             ? reconciliationHistory[0].paymentReference
                             : null);

  // Determine payment mode
  let paymentMode = 'cash';
  if (paymentDetails?.paymentMethod) {
    const method = paymentDetails.paymentMethod.toLowerCase();
    if (method.includes('mpesa') || method.includes('m-pesa')) {
      paymentMode = 'mpesa';
    } else if (method.includes('bank') || method.includes('transfer')) {
      paymentMode = 'bank_transfer';
    } else if (method.includes('card') || method.includes('credit')) {
      paymentMode = 'creditcard';
    } else if (method.includes('cheque') || method.includes('check')) {
      paymentMode = 'check';
    }
  }

  // Build payment description
  let description = `Payment for invoice`;
  if (paymentDetails?.paymentMethod) {
    description = `${paymentDetails.paymentMethod} payment`;
  }
  if (status === 'Paid') {
    description += ' - Full payment';
  } else if (status === 'Partially Paid') {
    description += ' - Partial payment';
  }

  return {
    customerId,
    amount: amountPaid,
    date: formatDate(paymentDate),
    paymentMode,
    referenceNumber: paymentReference || `PAY-${Date.now()}`,
    description,
    invoices: [
      {
        invoiceId,
        amountApplied: Math.min(amountPaid, totalAmount)
      }
    ]
  };
}

/**
 * Record payment for invoice
 * Convenience method that creates payment and applies it to invoice
 * @param {Object} invoiceData - Invoice data from your system
 * @param {string} customerId - Zoho customer ID
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<Object|null>} Created payment or null if no payment needed
 */
async function recordInvoicePayment(invoiceData, customerId, invoiceId) {
  try {
    // Map payment data
    const paymentData = mapPaymentToZohoFormat(invoiceData, customerId, invoiceId);

    if (!paymentData) {
      console.log('⚠️  No payment to record (invoice not paid)');
      return null;
    }

    // Create payment
    const payment = await createPayment(paymentData);

    console.log(`✅ Payment recorded successfully for invoice`);
    return payment;

  } catch (error) {
    console.error('❌ Error recording invoice payment:', error.message);
    throw {
      message: 'Failed to record invoice payment',
      originalError: error,
      code: 'INVOICE_PAYMENT_RECORD_FAILED'
    };
  }
}

module.exports = {
  createPayment,
  getPaymentById,
  listPayments,
  updatePayment,
  deletePayment,
  applyCreditsToInvoice,
  getInvoicePayments,
  mapPaymentToZohoFormat,
  recordInvoicePayment
};
