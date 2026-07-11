/**
 * Zoho Books Advanced Payment Management Module
 * Handles complex payment operations including partial payments,
 * payment history, and multiple payment methods
 */

const { authenticatedRequest } = require("./auth");
const { ZOHO_CONFIG } = require("./config");
const { getInvoiceById } = require("./invoice");
const { createPayment } = require("./payment");
const logger = require("../../../../config/winston");

/**
 * Add payment to an existing invoice
 * Supports partial and full payments
 *
 * @param {Object} paymentInfo - Payment information
 * @param {string} paymentInfo.invoiceId - Zoho invoice ID
 * @param {string} paymentInfo.customerId - Zoho customer ID
 * @param {number} paymentInfo.amount - Payment amount
 * @param {string} paymentInfo.paymentDate - Payment date (YYYY-MM-DD)
 * @param {string} paymentInfo.paymentMode - Payment method (mpesa, bank_transfer, cash, etc.)
 * @param {string} paymentInfo.referenceNumber - Transaction reference/ID
 * @param {string} paymentInfo.description - Payment description (optional)
 * @param {string} paymentInfo.notes - Additional notes (optional)
 * @param {boolean} paymentInfo.sendEmail - Send payment receipt email (default: false)
 * @returns {Promise<Object>} Created payment details with invoice balance
 */
async function addPaymentToInvoice(paymentInfo) {
  try {
    const {
      invoiceId,
      customerId,
      amount,
      paymentDate,
      paymentMode = ZOHO_CONFIG.defaultPaymentMode,
      referenceNumber,
      description,
      notes,
      sendEmail = false,
    } = paymentInfo;

    // Validate required fields
    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }
    if (!customerId) {
      throw new Error("Customer ID is required");
    }
    if (!amount || amount <= 0) {
      throw new Error("Valid payment amount is required");
    }
    if (!paymentDate) {
      throw new Error("Payment date is required");
    }

    console.log(`💰 Adding payment to invoice: ${invoiceId}`);
    logger.info("Adding payment to invoice", {
      invoiceId,
      customerId,
      amount,
      paymentMode,
    });

    // Step 1: Get invoice details to check balance
    const invoice = await getInvoiceById(invoiceId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const invoiceBalance = parseFloat(invoice.balance || 0);
    const invoiceTotal = parseFloat(invoice.total || 0);
    const paymentAmount = parseFloat(amount);

    console.log(
      `   Invoice Balance: ${invoice.currency_code} ${invoiceBalance}`,
    );
    console.log(`   Payment Amount: ${invoice.currency_code} ${paymentAmount}`);

    // Step 2: Check payment amount and allow overpayments
    // Zoho Books supports overpayments - they create customer credits automatically
    if (paymentAmount > invoiceBalance) {
      const overpaymentAmount = paymentAmount - invoiceBalance;
      console.log(
        `   ⚠️  Overpayment detected: ${invoice.currency_code} ${overpaymentAmount}`,
      );
      console.log(`   💰 This will create a customer credit in Zoho Books`);
      logger.info("Overpayment will be processed", {
        invoiceId,
        balance: invoiceBalance,
        paymentAmount,
        overpaymentAmount,
      });
    }

    // Step 3: Determine payment type (partial, full, or overpayment)
    const isPartialPayment = paymentAmount < invoiceBalance;
    const isFullPayment = paymentAmount === invoiceBalance;
    const isOverpayment = paymentAmount > invoiceBalance;

    const paymentType = isOverpayment
      ? "Overpayment"
      : isFullPayment
        ? "Full Payment"
        : "Partial Payment";

    console.log(`   Payment Type: ${paymentType}`);
    logger.info("Payment type determined", {
      invoiceId,
      isPartialPayment,
      isFullPayment,
      isOverpayment,
      remainingBalance: invoiceBalance - paymentAmount,
      customerCredit: isOverpayment ? paymentAmount - invoiceBalance : 0,
    });

    // Step 4: Format payment date
    const formattedDate = formatPaymentDate(paymentDate);

    // Step 5: Handle overpayment by splitting payment
    let invoicePayment;
    let creditPayment = null;
    let overpaymentAmount = 0;

    if (isOverpayment) {
      console.log("   🔀 Splitting payment: Invoice payment + Customer credit");

      // Part 1: Apply invoice balance to the invoice
      const invoicePaymentAmount = invoiceBalance;
      overpaymentAmount = paymentAmount - invoiceBalance;

      console.log(
        `   💵 Invoice Payment: ${invoice.currency_code} ${invoicePaymentAmount}`,
      );
      console.log(
        `   💰 Customer Credit: ${invoice.currency_code} ${overpaymentAmount}`,
      );

      const invoicePaymentData = {
        customer_id: customerId,
        payment_mode: paymentMode,
        amount: invoicePaymentAmount,
        date: formattedDate,
        invoices: [
          {
            invoice_id: invoiceId,
            amount_applied: invoicePaymentAmount,
          },
        ],
      };

      // Add optional fields for invoice payment
      if (referenceNumber) {
        invoicePaymentData.reference_number = referenceNumber;
      } else {
        invoicePaymentData.reference_number = `PAY-INV-${Date.now()}`;
      }

      if (description) {
        invoicePaymentData.description = description;
      } else {
        invoicePaymentData.description = `Payment for invoice ${invoice.invoice_number}`;
      }

      if (notes) {
        invoicePaymentData.notes = notes;
      }

      // Create invoice payment
      console.log("   📝 Creating invoice payment...");
      const invoiceResponse = await authenticatedRequest({
        method: "POST",
        url: ZOHO_CONFIG.endpoints.payments,
        data: invoicePaymentData,
        params: sendEmail ? { send_customer_email: true } : {},
      });

      if (invoiceResponse.code !== 0 || !invoiceResponse.payment) {
        throw new Error(
          "Failed to create invoice payment - Invalid response from Zoho",
        );
      }

      invoicePayment = invoiceResponse.payment;
      console.log(
        `   ✅ Invoice payment created: ${invoicePayment.payment_id}`,
      );

      // Part 2: Create customer credit for overpayment
      console.log("   📝 Creating customer credit...");

      const creditPaymentData = {
        customerId: customerId,
        amount: overpaymentAmount,
        date: formattedDate,
        paymentMode: paymentMode,
        referenceNumber: referenceNumber
          ? `${referenceNumber}-CREDIT`
          : `PAY-CREDIT-${Date.now()}`,
        description: description
          ? `${description} (Overpayment credit)`
          : `Customer credit from overpayment on invoice ${invoice.invoice_number}`,
        notes: notes
          ? `${notes} - Overpayment: ${overpaymentAmount}`
          : `Overpayment credit: ${overpaymentAmount}`,
        invoices: [], // No invoice - becomes customer credit
      };

      creditPayment = await createPayment(creditPaymentData);
      console.log(`   ✅ Customer credit created: ${creditPayment.payment_id}`);
    } else {
      // Normal payment (partial or full, no overpayment)
      const paymentData = {
        customer_id: customerId,
        payment_mode: paymentMode,
        amount: paymentAmount,
        date: formattedDate,
        invoices: [
          {
            invoice_id: invoiceId,
            amount_applied: paymentAmount,
          },
        ],
      };

      // Add optional fields
      if (referenceNumber) {
        paymentData.reference_number = referenceNumber;
      } else {
        paymentData.reference_number = `PAY-${Date.now()}`;
      }

      if (description) {
        paymentData.description = description;
      } else {
        paymentData.description = isFullPayment
          ? `Full payment for invoice ${invoice.invoice_number}`
          : `Partial payment for invoice ${invoice.invoice_number}`;
      }

      if (notes) {
        paymentData.notes = notes;
      }

      // Step 6: Create payment in Zoho
      console.log("   Creating payment in Zoho Books...");
      const response = await authenticatedRequest({
        method: "POST",
        url: ZOHO_CONFIG.endpoints.payments,
        data: paymentData,
        params: sendEmail ? { send_customer_email: true } : {},
      });

      if (response.code !== 0 || !response.payment) {
        throw new Error(
          "Failed to create payment - Invalid response from Zoho",
        );
      }

      invoicePayment = response.payment;
    }

    // Step 7: Get updated invoice to check new balance
    const updatedInvoice = await getInvoiceById(invoiceId);
    const newBalance = parseFloat(updatedInvoice.balance || 0);

    console.log("✅ Payment added successfully");
    console.log(`   Payment ID: ${invoicePayment.payment_id}`);
    console.log(`   Payment Number: ${invoicePayment.payment_number}`);
    console.log(
      `   Amount Paid to Invoice: ${invoicePayment.currency_code} ${invoicePayment.amount}`,
    );
    if (creditPayment) {
      console.log(`   Customer Credit ID: ${creditPayment.payment_id}`);
      console.log(
        `   Customer Credit Amount: ${invoice.currency_code} ${overpaymentAmount}`,
      );
    }
    console.log(
      `   New Invoice Balance: ${updatedInvoice.currency_code} ${newBalance}`,
    );
    console.log(`   Invoice Status: ${updatedInvoice.status}`);

    logger.info("Payment added successfully", {
      paymentId: invoicePayment.payment_id,
      paymentNumber: invoicePayment.payment_number,
      invoiceId,
      amount: invoicePayment.amount,
      newBalance,
      invoiceStatus: updatedInvoice.status,
      overpayment: isOverpayment,
      overpaymentAmount: overpaymentAmount,
      creditPaymentId: creditPayment ? creditPayment.payment_id : null,
    });

    const responseData = {
      success: true,
      message: isOverpayment
        ? `Payment recorded successfully with ${invoice.currency_code} ${overpaymentAmount} customer credit`
        : isFullPayment
          ? "Full payment recorded successfully"
          : "Partial payment recorded successfully",
      data: {
        payment: {
          id: invoicePayment.payment_id,
          number: invoicePayment.payment_number,
          date: invoicePayment.date,
          amount: invoicePayment.amount,
          mode: invoicePayment.payment_mode,
          reference: invoicePayment.reference_number,
          description: invoicePayment.description,
          currencyCode: invoicePayment.currency_code,
        },
        invoice: {
          id: updatedInvoice.invoice_id,
          number: updatedInvoice.invoice_number,
          total: invoiceTotal,
          previousBalance: invoiceBalance,
          newBalance: newBalance,
          amountPaid: invoiceTotal - newBalance,
          status: updatedInvoice.status,
          isPaid: updatedInvoice.status === "paid",
          isPartiallyPaid: updatedInvoice.status === "partially_paid",
        },
      },
      timestamp: new Date().toISOString(),
    };

    // Add customer credit info if overpayment occurred
    if (creditPayment) {
      responseData.data.customerCredit = {
        id: creditPayment.payment_id,
        number: creditPayment.payment_number,
        amount: overpaymentAmount,
        date: creditPayment.date,
        reference: creditPayment.reference_number,
        description: creditPayment.description,
        currencyCode: invoice.currency_code,
      };
      responseData.data.overpaymentAmount = overpaymentAmount;
    }

    return responseData;
  } catch (error) {
    console.error("❌ Error adding payment to invoice:", error.message);
    logger.error("Failed to add payment to invoice", {
      error: error.message || error,
      invoiceId: paymentInfo.invoiceId,
    });

    throw {
      message: "Failed to add payment to invoice",
      originalError: error.message || error,
      code: "PAYMENT_ADD_FAILED",
      invoiceId: paymentInfo.invoiceId,
    };
  }
}

/**
 * Add multiple payments to an invoice
 * Useful for recording multiple payment transactions
 *
 * @param {string} invoiceId - Zoho invoice ID
 * @param {string} customerId - Zoho customer ID
 * @param {Array<Object>} payments - Array of payment objects
 * @returns {Promise<Object>} Results of all payment operations
 */
async function addMultiplePayments(invoiceId, customerId, payments) {
  try {
    console.log(
      `\n💰 Adding ${payments.length} payments to invoice ${invoiceId}`,
    );
    logger.info("Adding multiple payments to invoice", {
      invoiceId,
      customerId,
      paymentCount: payments.length,
    });

    const results = {
      success: true,
      total: payments.length,
      successful: 0,
      failed: 0,
      payments: [],
      errors: [],
    };

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      console.log(`\n   Payment ${i + 1}/${payments.length}:`);

      try {
        const result = await addPaymentToInvoice({
          invoiceId,
          customerId,
          ...payment,
        });

        results.successful++;
        results.payments.push({
          index: i,
          success: true,
          data: result.data,
        });

        console.log(`   ✅ Payment ${i + 1} recorded successfully`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          payment: payment,
          error: error.message || error,
        });

        console.log(`   ❌ Payment ${i + 1} failed: ${error.message}`);
        logger.error("Payment in batch failed", {
          invoiceId,
          paymentIndex: i,
          error: error.message,
        });
      }
    }

    results.success = results.failed === 0;

    console.log(
      `\n✅ Batch payment complete: ${results.successful}/${results.total} successful`,
    );
    logger.info("Multiple payments added", {
      invoiceId,
      total: results.total,
      successful: results.successful,
      failed: results.failed,
    });

    return results;
  } catch (error) {
    console.error("❌ Error in batch payment operation:", error.message);
    logger.error("Batch payment operation failed", {
      error: error.message,
      invoiceId,
    });

    throw {
      message: "Failed to add multiple payments",
      originalError: error.message || error,
      code: "BATCH_PAYMENT_FAILED",
    };
  }
}

/**
 * Get all payments for a specific invoice
 *
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<Array>} Array of payment objects
 */
async function getInvoicePayments(invoiceId) {
  try {
    console.log(`🔍 Getting payments for invoice: ${invoiceId}`);
    logger.info("Fetching invoice payments", { invoiceId });

    const response = await authenticatedRequest({
      method: "GET",
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}/payments`,
    });

    if (response.code === 0) {
      const payments = response.payments || [];

      console.log(`✅ Found ${payments.length} payment(s) for invoice`);
      logger.info("Invoice payments retrieved", {
        invoiceId,
        paymentCount: payments.length,
      });

      return payments.map((payment) => ({
        id: payment.payment_id,
        number: payment.payment_number,
        amount: payment.amount,
        date: payment.date,
        mode: payment.payment_mode,
        reference: payment.reference_number,
        description: payment.description,
        invoicePaymentId: payment.invoice_payment_id,
        amountApplied: payment.amount_applied,
      }));
    }

    return [];
  } catch (error) {
    console.error("❌ Error getting invoice payments:", error.message);
    logger.error("Failed to get invoice payments", {
      error: error.message,
      invoiceId,
    });

    throw {
      message: "Failed to get invoice payments",
      originalError: error.message || error,
      code: "GET_INVOICE_PAYMENTS_FAILED",
    };
  }
}

/**
 * Get payment history summary for an invoice
 * Includes total paid, balance, and payment breakdown
 *
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<Object>} Payment history summary
 */
async function getPaymentHistory(invoiceId) {
  try {
    console.log(`📊 Getting payment history for invoice: ${invoiceId}`);
    logger.info("Fetching payment history", { invoiceId });

    // Get invoice details
    const invoice = await getInvoiceById(invoiceId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Get all payments
    const payments = await getInvoicePayments(invoiceId);

    // Calculate totals
    const totalInvoiceAmount = parseFloat(invoice.total || 0);
    const currentBalance = parseFloat(invoice.balance || 0);
    const totalPaid = totalInvoiceAmount - currentBalance;
    const paymentCount = payments.length;

    // Group payments by mode
    const paymentsByMode = payments.reduce((acc, payment) => {
      const mode = payment.mode || "unknown";
      if (!acc[mode]) {
        acc[mode] = {
          count: 0,
          total: 0,
          payments: [],
        };
      }
      acc[mode].count++;
      acc[mode].total += parseFloat(payment.amount || 0);
      acc[mode].payments.push(payment);
      return acc;
    }, {});

    // Sort payments by date (newest first)
    const sortedPayments = payments.sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    const history = {
      invoice: {
        id: invoice.invoice_id,
        number: invoice.invoice_number,
        total: totalInvoiceAmount,
        balance: currentBalance,
        totalPaid: totalPaid,
        status: invoice.status,
        currencyCode: invoice.currency_code,
        isPaid: invoice.status === "paid",
        isPartiallyPaid: invoice.status === "partially_paid",
      },
      paymentSummary: {
        totalPayments: paymentCount,
        totalAmountPaid: totalPaid,
        percentagePaid:
          totalInvoiceAmount > 0
            ? ((totalPaid / totalInvoiceAmount) * 100).toFixed(2)
            : 0,
        averagePaymentAmount:
          paymentCount > 0 ? (totalPaid / paymentCount).toFixed(2) : 0,
        paymentsByMode: paymentsByMode,
      },
      payments: sortedPayments,
      lastPayment: sortedPayments[0] || null,
    };

    console.log(`✅ Payment history retrieved`);
    console.log(`   Total Payments: ${paymentCount}`);
    console.log(`   Total Paid: ${invoice.currency_code} ${totalPaid}`);
    console.log(`   Balance: ${invoice.currency_code} ${currentBalance}`);
    console.log(`   Status: ${invoice.status}`);

    logger.info("Payment history retrieved", {
      invoiceId,
      totalPayments: paymentCount,
      totalPaid,
      balance: currentBalance,
      status: invoice.status,
    });

    return history;
  } catch (error) {
    console.error("❌ Error getting payment history:", error.message);
    logger.error("Failed to get payment history", {
      error: error.message,
      invoiceId,
    });

    throw {
      message: "Failed to get payment history",
      originalError: error.message || error,
      code: "GET_PAYMENT_HISTORY_FAILED",
    };
  }
}

/**
 * Delete a payment from an invoice
 * This will increase the invoice balance
 *
 * @param {string} paymentId - Zoho payment ID
 * @returns {Promise<Object>} Deletion result
 */
async function deletePayment(paymentId) {
  try {
    console.log(`🗑️  Deleting payment: ${paymentId}`);
    logger.info("Deleting payment", { paymentId });

    const response = await authenticatedRequest({
      method: "DELETE",
      url: `${ZOHO_CONFIG.endpoints.payments}/${paymentId}`,
    });

    if (response.code === 0) {
      console.log(`✅ Payment deleted successfully`);
      logger.info("Payment deleted", { paymentId });

      return {
        success: true,
        message: "Payment deleted successfully",
        paymentId,
      };
    }

    throw new Error("Failed to delete payment - Invalid response");
  } catch (error) {
    console.error("❌ Error deleting payment:", error.message);
    logger.error("Failed to delete payment", {
      error: error.message,
      paymentId,
    });

    throw {
      message: "Failed to delete payment",
      originalError: error.message || error,
      code: "DELETE_PAYMENT_FAILED",
    };
  }
}

/**
 * Update payment details
 *
 * @param {string} paymentId - Zoho payment ID
 * @param {Object} updates - Payment fields to update
 * @returns {Promise<Object>} Updated payment details
 */
async function updatePayment(paymentId, updates) {
  try {
    console.log(`📝 Updating payment: ${paymentId}`);
    logger.info("Updating payment", { paymentId, updates });

    const response = await authenticatedRequest({
      method: "PUT",
      url: `${ZOHO_CONFIG.endpoints.payments}/${paymentId}`,
      data: updates,
    });

    if (response.code === 0 && response.payment) {
      console.log(`✅ Payment updated successfully`);
      logger.info("Payment updated", {
        paymentId,
        paymentNumber: response.payment.payment_number,
      });

      return response.payment;
    }

    throw new Error("Failed to update payment - Invalid response");
  } catch (error) {
    console.error("❌ Error updating payment:", error.message);
    logger.error("Failed to update payment", {
      error: error.message,
      paymentId,
    });

    throw {
      message: "Failed to update payment",
      originalError: error.message || error,
      code: "UPDATE_PAYMENT_FAILED",
    };
  }
}

/**
 * Validate payment data before submission
 *
 * @param {Object} paymentData - Payment data to validate
 * @returns {Object} Validation result
 */
function validatePaymentData(paymentData) {
  const errors = [];

  if (!paymentData.invoiceId) {
    errors.push("Invoice ID is required");
  }

  if (!paymentData.customerId) {
    errors.push("Customer ID is required");
  }

  if (!paymentData.amount) {
    errors.push("Payment amount is required");
  } else if (isNaN(paymentData.amount) || paymentData.amount <= 0) {
    errors.push("Payment amount must be a positive number");
  }

  if (!paymentData.paymentDate) {
    errors.push("Payment date is required");
  } else {
    const date = new Date(paymentData.paymentDate);
    if (isNaN(date.getTime())) {
      errors.push("Invalid payment date format");
    }
  }

  const validPaymentModes = [
    "mpesa",
    "cash",
    "bank_transfer",
    "creditcard",
    "check",
    "bank_remittance",
    "paypal",
    "credit",
    "authorizenet",
    "stripe",
    "other",
  ];

  if (
    paymentData.paymentMode &&
    !validPaymentModes.includes(paymentData.paymentMode)
  ) {
    errors.push(
      `Invalid payment mode. Valid modes: ${validPaymentModes.join(", ")}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Format payment date to Zoho format (YYYY-MM-DD)
 *
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatPaymentDate(date) {
  if (!date) {
    return new Date().toISOString().split("T")[0];
  }

  if (typeof date === "string") {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date format");
    }
    return parsedDate.toISOString().split("T")[0];
  }

  if (date instanceof Date) {
    return date.toISOString().split("T")[0];
  }

  throw new Error("Date must be a string or Date object");
}

/**
 * Get payment modes configuration
 * Returns list of available payment modes with descriptions
 *
 * @returns {Array<Object>} Payment modes
 */
function getPaymentModes() {
  return [
    { code: "mpesa", name: "M-Pesa", description: "Mobile money payment" },
    { code: "cash", name: "Cash", description: "Cash payment" },
    {
      code: "bank_transfer",
      name: "Bank Transfer",
      description: "Direct bank transfer",
    },
    {
      code: "creditcard",
      name: "Credit Card",
      description: "Credit/Debit card payment",
    },
    { code: "check", name: "Cheque", description: "Cheque payment" },
    {
      code: "bank_remittance",
      name: "Bank Remittance",
      description: "Bank remittance",
    },
    { code: "paypal", name: "PayPal", description: "PayPal payment" },
    { code: "stripe", name: "Stripe", description: "Stripe payment" },
    { code: "other", name: "Other", description: "Other payment method" },
  ];
}

module.exports = {
  // Main payment operations
  addPaymentToInvoice,
  addMultiplePayments,

  // Payment retrieval
  getInvoicePayments,
  getPaymentHistory,

  // Payment management
  deletePayment,
  updatePayment,

  // Utilities
  validatePaymentData,
  formatPaymentDate,
  getPaymentModes,
};
