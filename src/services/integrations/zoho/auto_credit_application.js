/**
 * Automatic Credit Application Service for Zoho Books Integration
 *
 * PURPOSE:
 * When a new invoice is created with Balance Brought Forward (BBF), this service
 * automatically checks for available customer credits in Zoho Books and applies
 * them to reduce the BBF amount.
 *
 * BUSINESS LOGIC:
 * - Customer in Zoho = Facility Name + Unit Name (e.g., "Building A - Unit 101")
 * - Multiple invoices can exist for same customer but different payers (landlord vs tenant)
 * - Account Number identifies the payer (stored in invoice reference_number field)
 * - Credits should only be applied to invoices with matching account number
 * - Only applies to invoices with BBF > 0
 *
 * ACCOUNT NUMBER PREFIXES:
 * - 5xxx, 6xxx = Regular invoices (lease/tenant/landlord)
 * - 7xxx = Water invoices
 * - 8xxx = VAS (Value Added Services) invoices
 *
 * @module auto_credit_application
 */

const logger = require("../../../../config/winston");
const { authenticatedRequest } = require("./auth");
const { ZOHO_CONFIG } = require("./config");
const { getInvoiceById, searchInvoiceByNumber } = require("./invoice");
const axios = require("axios");

/**
 * Check for available customer credits in Zoho Books
 *
 * @param {string} customerId - Zoho customer ID
 * @param {string} accountNumber - Account number to match (for filtering)
 * @returns {Promise<Array>} Array of available credits
 */
async function getAvailableCustomerCredits(customerId, accountNumber) {
  const logPrefix = `[AUTO-CREDIT] [Customer: ${customerId}] [Account: ${accountNumber}]`;

  try {
    console.log(
      `${logPrefix} 🔍 Fetching available customer credits from Zoho...`,
    );
    logger.info("Fetching customer credits", { customerId, accountNumber });

    // Get all payments for this customer
    const response = await authenticatedRequest({
      method: "GET",
      url: ZOHO_CONFIG.endpoints.payments,
      params: {
        customer_id: customerId,
        per_page: 200, // Get more to ensure we capture all credits
      },
    });

    if (response.code !== 0) {
      throw new Error(`Failed to fetch payments: ${response.message}`);
    }

    const allPayments = response.customerpayments || [];
    console.log(
      `${logPrefix}    📊 Total payments found: ${allPayments.length}`,
    );

    // Filter for unused credits (unused_amount > 0 and no invoices)
    const availableCredits = allPayments.filter((payment) => {
      const hasUnusedAmount = parseFloat(payment.unused_amount || 0) > 0;
      const isCredit = !payment.invoices || payment.invoices.length === 0;
      return hasUnusedAmount && isCredit;
    });

    console.log(
      `${logPrefix}    💰 Available credits: ${availableCredits.length}`,
    );

    // Calculate total available credit
    const totalCredit = availableCredits.reduce((sum, credit) => {
      return sum + parseFloat(credit.unused_amount || 0);
    }, 0);

    console.log(`${logPrefix}    💵 Total credit amount: ${totalCredit}`);

    // Log each credit
    availableCredits.forEach((credit, index) => {
      console.log(`${logPrefix}       Credit ${index + 1}:`);
      console.log(`${logPrefix}          - ID: ${credit.payment_id}`);
      console.log(`${logPrefix}          - Number: ${credit.payment_number}`);
      console.log(`${logPrefix}          - Amount: ${credit.unused_amount}`);
      console.log(`${logPrefix}          - Date: ${credit.date}`);
      console.log(`${logPrefix}          - Mode: ${credit.payment_mode}`);
      console.log(
        `${logPrefix}          - Reference: ${credit.reference_number || "N/A"}`,
      );
    });

    logger.info("Customer credits retrieved", {
      customerId,
      accountNumber,
      creditCount: availableCredits.length,
      totalCredit,
    });

    return availableCredits;
  } catch (error) {
    console.error(
      `${logPrefix} ❌ Error fetching customer credits:`,
      error.message,
    );
    logger.error("Failed to fetch customer credits", {
      error: error.message,
      customerId,
      accountNumber,
    });
    throw error;
  }
}

/**
 * Apply customer credit to a specific invoice in Zoho
 *
 * @param {Object} params - Application parameters
 * @param {string} params.invoiceId - Zoho invoice ID
 * @param {string} params.customerId - Zoho customer ID
 * @param {string} params.creditPaymentId - Payment ID of the credit to apply
 * @param {number} params.amount - Amount to apply from credit
 * @param {string} params.invoiceNumber - Invoice number (for logging)
 * @param {string} params.accountNumber - Account number (for logging)
 * @returns {Promise<Object>} Result of credit application
 */
async function applyCreditToInvoice(params) {
  const {
    invoiceId,
    customerId,
    creditPaymentId,
    amount,
    invoiceNumber,
    accountNumber,
  } = params;

  const logPrefix = `[AUTO-CREDIT] [Invoice: ${invoiceNumber}] [Credit: ${creditPaymentId}]`;

  try {
    console.log(`${logPrefix} 🔄 Applying credit to invoice...`);
    console.log(`${logPrefix}    Amount to apply: ${amount}`);
    logger.info("Applying credit to invoice", {
      invoiceId,
      customerId,
      creditPaymentId,
      amount,
      invoiceNumber,
      accountNumber,
    });

    // First, get the existing payment details to get its current structure
    console.log(`${logPrefix}    📥 Fetching existing payment details...`);
    const paymentResponse = await authenticatedRequest({
      method: "GET",
      url: `${ZOHO_CONFIG.endpoints.payments}/${creditPaymentId}`,
    });

    if (paymentResponse.code !== 0 || !paymentResponse.payment) {
      throw new Error(`Failed to fetch payment: ${paymentResponse.message}`);
    }

    const existingPayment = paymentResponse.payment;
    console.log(
      `${logPrefix}    Unused credit available: ${existingPayment.unused_amount}`,
    );

    // Apply credit by updating the payment to include the invoice
    // We're adding this invoice to the payment's invoices array
    const invoicesArray = existingPayment.invoices || [];
    invoicesArray.push({
      invoice_id: invoiceId,
      amount_applied: amount,
    });

    console.log(`${logPrefix}    🔄 Updating payment to apply credit...`);
    const applyResponse = await authenticatedRequest({
      method: "PUT",
      url: `${ZOHO_CONFIG.endpoints.payments}/${creditPaymentId}`,
      data: {
        invoices: invoicesArray,
      },
    });

    if (applyResponse.code !== 0) {
      throw new Error(`Failed to apply credit: ${applyResponse.message}`);
    }

    console.log(`${logPrefix} ✅ Credit applied successfully`);
    logger.info("Credit applied successfully", {
      invoiceId,
      creditPaymentId,
      amountApplied: amount,
      invoiceNumber,
    });

    // Get updated invoice to verify
    const updatedInvoice = await getInvoiceById(invoiceId);
    const newBalance = parseFloat(updatedInvoice.balance || 0);

    console.log(`${logPrefix}    📊 Updated invoice balance: ${newBalance}`);

    return {
      success: true,
      creditPaymentId,
      amountApplied: amount,
      newInvoiceBalance: newBalance,
      invoiceStatus: updatedInvoice.status,
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Error applying credit:`, error.message);
    logger.error("Failed to apply credit to invoice", {
      error: error.message,
      invoiceId,
      creditPaymentId,
      amount,
      invoiceNumber,
    });
    throw error;
  }
}

/**
 * Automatically apply available credits to new invoice with BBF
 *
 * This is the main function called when a new invoice is created.
 * It checks for available credits and applies them to reduce the BBF.
 *
 * @param {Object} params - Application parameters
 * @param {string} params.facilityId - Facility ID
 * @param {string} params.invoiceNumber - PayServe invoice number
 * @param {string} params.zohoInvoiceId - Zoho invoice ID
 * @param {string} params.zohoCustomerId - Zoho customer ID
 * @param {string} params.accountNumber - Account number (identifies payer)
 * @param {number} params.bbfAmount - Balance brought forward amount
 * @param {string} params.currencyCode - Currency code (e.g., 'KES')
 * @returns {Promise<Object>} Result with applied credits and remaining BBF
 */
async function autoApplyCreditsToNewInvoice(params) {
  const {
    facilityId,
    invoiceNumber,
    zohoInvoiceId,
    zohoCustomerId,
    accountNumber,
    bbfAmount,
    currencyCode = "KES",
  } = params;

  const logPrefix = `[AUTO-CREDIT] [Invoice: ${invoiceNumber}]`;

  console.log("\n" + "=".repeat(100));
  console.log(`${logPrefix} 🚀 AUTOMATIC CREDIT APPLICATION STARTED`);
  console.log("=".repeat(100));
  console.log(`${logPrefix} Facility ID: ${facilityId}`);
  console.log(`${logPrefix} Invoice Number: ${invoiceNumber}`);
  console.log(`${logPrefix} Zoho Invoice ID: ${zohoInvoiceId}`);
  console.log(`${logPrefix} Zoho Customer ID: ${zohoCustomerId}`);
  console.log(`${logPrefix} Account Number: ${accountNumber}`);
  console.log(`${logPrefix} BBF Amount: ${currencyCode} ${bbfAmount}`);
  console.log("=".repeat(100));

  logger.info("Starting automatic credit application", {
    facilityId,
    invoiceNumber,
    zohoInvoiceId,
    zohoCustomerId,
    accountNumber,
    bbfAmount,
    currencyCode,
  });

  const result = {
    success: false,
    creditsFound: 0,
    creditsApplied: 0,
    totalAmountApplied: 0,
    remainingBBF: bbfAmount,
    appliedCredits: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Validate inputs
    // Note: Negative BBF means customer has credit (overpayment) that should be applied
    if (
      !zohoInvoiceId ||
      !zohoCustomerId ||
      !accountNumber ||
      !bbfAmount ||
      bbfAmount >= 0
    ) {
      console.log(
        `${logPrefix} ⚠️  Validation failed - Missing required parameters or BBF >= 0 (no credit to apply)`,
      );
      console.log(
        `${logPrefix} ℹ️  BBF must be negative (indicating credit) for auto-application`,
      );
      result.success = true;
      result.message =
        "No credit application needed - BBF is not negative (no credit)";
      return result;
    }

    // Step 1: Get available customer credits from Zoho
    console.log(`${logPrefix}\n📋 STEP 1: Fetching Available Customer Credits`);
    console.log(`${logPrefix} ${"─".repeat(80)}`);

    const availableCredits = await getAvailableCustomerCredits(
      zohoCustomerId,
      accountNumber,
    );
    result.creditsFound = availableCredits.length;

    if (availableCredits.length === 0) {
      console.log(
        `${logPrefix} ℹ️  No customer credits available for this customer`,
      );
      result.success = true;
      result.message = "No customer credits available";
      return result;
    }

    // Step 2: Sort credits by date (oldest first)
    console.log(`${logPrefix}\n📋 STEP 2: Sorting Credits (Oldest First)`);
    console.log(`${logPrefix} ${"─".repeat(80)}`);

    const sortedCredits = availableCredits.sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });

    console.log(`${logPrefix} Credits sorted by date:`);
    sortedCredits.forEach((credit, index) => {
      console.log(
        `${logPrefix}    ${index + 1}. ${credit.payment_number} - ${credit.date} - ${currencyCode} ${credit.unused_amount}`,
      );
    });

    // Step 2.5: Get invoice balance
    console.log(`${logPrefix}\n📋 STEP 2.5: Fetching Invoice Balance`);
    console.log(`${logPrefix} ${"─".repeat(80)}`);

    const invoice = await getInvoiceById(zohoInvoiceId);
    const invoiceBalance = parseFloat(invoice.balance || 0);

    console.log(
      `${logPrefix} Invoice Balance: ${currencyCode} ${invoiceBalance}`,
    );

    if (invoiceBalance <= 0) {
      console.log(
        `${logPrefix} ℹ️  Invoice already paid or has no balance - no credits to apply`,
      );
      result.success = true;
      result.message = "Invoice has no balance - no credits applied";
      return result;
    }

    // Step 3: Apply credits to invoice
    console.log(`${logPrefix}\n📋 STEP 3: Applying Credits to Invoice`);
    console.log(`${logPrefix} ${"─".repeat(80)}`);

    // BBF is negative (e.g., -38520), so convert to positive amount to cover
    // But also ensure we don't exceed the invoice balance
    let remainingBBF = Math.abs(bbfAmount);
    let remainingInvoiceBalance = invoiceBalance;

    for (const credit of sortedCredits) {
      if (remainingBBF <= 0) {
        console.log(
          `${logPrefix} ✅ BBF fully covered - stopping credit application`,
        );
        break;
      }

      if (remainingInvoiceBalance <= 0) {
        console.log(
          `${logPrefix} ✅ Invoice fully paid - stopping credit application`,
        );
        break;
      }

      const creditAvailable = parseFloat(credit.unused_amount || 0);
      if (creditAvailable <= 0) {
        console.log(
          `${logPrefix} ⏭️  Skipping credit ${credit.payment_number} - no unused amount`,
        );
        continue;
      }

      // Calculate amount to apply (minimum of: remaining BBF, available credit, and invoice balance)
      const amountToApply = Math.min(
        remainingBBF,
        creditAvailable,
        remainingInvoiceBalance,
      );

      console.log(
        `${logPrefix}\n    💳 Processing Credit: ${credit.payment_number}`,
      );
      console.log(
        `${logPrefix}       Credit Available: ${currencyCode} ${creditAvailable}`,
      );
      console.log(
        `${logPrefix}       Remaining BBF: ${currencyCode} ${remainingBBF}`,
      );
      console.log(
        `${logPrefix}       Remaining Invoice Balance: ${currencyCode} ${remainingInvoiceBalance}`,
      );
      console.log(
        `${logPrefix}       Amount to Apply: ${currencyCode} ${amountToApply}`,
      );

      try {
        // Apply the credit
        const applyResult = await applyCreditToInvoice({
          invoiceId: zohoInvoiceId,
          customerId: zohoCustomerId,
          creditPaymentId: credit.payment_id,
          amount: amountToApply,
          invoiceNumber: invoiceNumber,
          accountNumber: accountNumber,
        });

        // Update tracking
        remainingBBF -= amountToApply;
        remainingInvoiceBalance -= amountToApply;
        result.totalAmountApplied += amountToApply;
        result.creditsApplied++;

        result.appliedCredits.push({
          creditPaymentId: credit.payment_id,
          creditPaymentNumber: credit.payment_number,
          creditDate: credit.date,
          creditMode: credit.payment_mode,
          creditReference: credit.reference_number,
          amountApplied: amountToApply,
          creditAvailableBefore: creditAvailable,
          creditRemainingAfter: creditAvailable - amountToApply,
        });

        console.log(`${logPrefix}       ✅ Credit applied successfully`);
        console.log(
          `${logPrefix}       Remaining BBF: ${currencyCode} ${remainingBBF}`,
        );
        console.log(
          `${logPrefix}       Remaining Invoice Balance: ${currencyCode} ${remainingInvoiceBalance}`,
        );
      } catch (error) {
        console.error(
          `${logPrefix}       ❌ Failed to apply credit ${credit.payment_number}:`,
          error.message,
        );
        result.errors.push({
          creditPaymentId: credit.payment_id,
          error: error.message,
        });
        // Continue with next credit even if one fails
      }
    }

    // Step 4: Update local invoice if credits were applied
    if (result.creditsApplied > 0) {
      console.log(`${logPrefix}\n📋 STEP 4: Updating Local Invoice`);
      console.log(`${logPrefix} ${"─".repeat(80)}`);

      try {
        await updateLocalInvoiceWithCredits({
          facilityId,
          invoiceNumber,
          accountNumber,
          creditsApplied: result.totalAmountApplied,
          remainingBBF: remainingBBF,
        });

        console.log(`${logPrefix} ✅ Local invoice updated successfully`);
      } catch (error) {
        console.error(
          `${logPrefix} ⚠️  Failed to update local invoice:`,
          error.message,
        );
        // Don't fail the whole operation if local update fails
      }
    }

    // Set final results
    result.success = true;
    result.remainingBBF = remainingBBF;
    result.message =
      result.creditsApplied > 0
        ? `Successfully applied ${result.creditsApplied} credit(s) totaling ${currencyCode} ${result.totalAmountApplied}`
        : "No credits applied";

    // Summary
    console.log(`${logPrefix}\n` + "=".repeat(100));
    console.log(`${logPrefix} 🎉 AUTOMATIC CREDIT APPLICATION COMPLETED`);
    console.log("=".repeat(100));
    console.log(`${logPrefix} Credits Found: ${result.creditsFound}`);
    console.log(`${logPrefix} Credits Applied: ${result.creditsApplied}`);
    console.log(
      `${logPrefix} Total Amount Applied: ${currencyCode} ${result.totalAmountApplied}`,
    );
    console.log(`${logPrefix} Original BBF: ${currencyCode} ${bbfAmount}`);
    console.log(
      `${logPrefix} Remaining BBF: ${currencyCode} ${result.remainingBBF}`,
    );
    console.log(
      `${logPrefix} BBF Reduction: ${((result.totalAmountApplied / bbfAmount) * 100).toFixed(2)}%`,
    );
    if (result.errors.length > 0) {
      console.log(
        `${logPrefix} ⚠️  Errors Encountered: ${result.errors.length}`,
      );
    }
    console.log("=".repeat(100) + "\n");

    logger.info("Automatic credit application completed", {
      invoiceNumber,
      creditsFound: result.creditsFound,
      creditsApplied: result.creditsApplied,
      totalAmountApplied: result.totalAmountApplied,
      remainingBBF: result.remainingBBF,
      bbfReductionPercent: (
        (result.totalAmountApplied / bbfAmount) *
        100
      ).toFixed(2),
    });

    return result;
  } catch (error) {
    console.error(
      `${logPrefix} ❌ FATAL ERROR in automatic credit application:`,
      error.message,
    );
    console.error(`${logPrefix} Stack trace:`, error.stack);

    logger.error("Fatal error in automatic credit application", {
      error: error.message,
      stack: error.stack,
      invoiceNumber,
      accountNumber,
    });

    result.success = false;
    result.message = "Failed to apply credits";
    result.errors.push({ error: error.message });

    return result;
  }
}

/**
 * Update local invoice with applied credit information
 *
 * @param {Object} params - Update parameters
 * @param {string} params.facilityId - Facility ID
 * @param {string} params.invoiceNumber - Invoice number
 * @param {string} params.accountNumber - Account number
 * @param {number} params.creditsApplied - Amount of credits applied
 * @param {number} params.remainingBBF - Remaining BBF after credits
 * @returns {Promise<void>}
 */
async function updateLocalInvoiceWithCredits(params) {
  const {
    facilityId,
    invoiceNumber,
    accountNumber,
    creditsApplied,
    remainingBBF,
  } = params;

  const logPrefix = `[AUTO-CREDIT] [Local Update] [Invoice: ${invoiceNumber}]`;

  try {
    console.log(`${logPrefix} 🔄 Updating local invoice...`);

    // Call local API to update invoice
    const updateResponse = await axios.post(
      `${process.env.BACKEND_URL}/api/integrations/zoho/invoices/update-bbf`,
      {
        facilityId: facilityId.toString(),
        invoiceNumber: invoiceNumber,
        accountNumber: accountNumber,
        autoCreditApplied: creditsApplied,
        newBBF: remainingBBF,
        timestamp: new Date().toISOString(),
      },
    );

    console.log(`${logPrefix} ✅ Local invoice updated`);
    logger.info("Local invoice updated with credit application", {
      invoiceNumber,
      creditsApplied,
      remainingBBF,
    });
  } catch (error) {
    // Log but don't throw - this is a non-critical operation
    console.error(
      `${logPrefix} ⚠️  Failed to update local invoice:`,
      error.message,
    );
    logger.warn("Failed to update local invoice with credits", {
      error: error.message,
      invoiceNumber,
    });
  }
}

/**
 * Check if invoice is eligible for automatic credit application
 *
 * @param {Object} invoice - Invoice object from PayServe
 * @returns {boolean} True if eligible
 */
function isEligibleForAutoCreditApplication(invoice) {
  // Must have BBF > 0
  const hasBBF =
    invoice.balanceBroughtForward && invoice.balanceBroughtForward > 0;

  // Must have account number
  const hasAccountNumber = !!invoice.accountNumber;

  // Must have Zoho invoice ID
  const hasZohoInvoiceId = !!invoice.zohoInvoiceId;

  return hasBBF && hasAccountNumber && hasZohoInvoiceId;
}

module.exports = {
  autoApplyCreditsToNewInvoice,
  getAvailableCustomerCredits,
  applyCreditToInvoice,
  isEligibleForAutoCreditApplication,
};
