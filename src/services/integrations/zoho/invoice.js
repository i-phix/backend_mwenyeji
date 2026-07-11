/**
 * Zoho Books Invoice Management Module
 * Handles invoice operations
 */

const { authenticatedRequest } = require("./auth");
const { ZOHO_CONFIG } = require("./config");

/**
 * Create invoice in Zoho Books
 * @param {Object} invoiceData - Invoice information
 * @returns {Promise<Object>} Created invoice details
 */
async function createInvoice(invoiceData) {
  try {
    const {
      customerId,
      invoiceNumber,
      referenceNumber,
      date,
      dueDate,
      currencyCode = ZOHO_CONFIG.defaultCurrency,
      lineItems,
      notes,
      terms,
      discount = 0,
      shippingCharge = 0,
      adjustment = 0,
      adjustmentDescription = "",
      allowPartialPayments = ZOHO_CONFIG.allowPartialPayments,
      paymentTerms,
      paymentTermsLabel,
    } = invoiceData;

    // Validate required fields
    if (!customerId) {
      throw new Error("Customer ID is required");
    }
    if (!lineItems || lineItems.length === 0) {
      throw new Error("At least one line item is required");
    }

    console.log(`📄 Creating invoice: ${invoiceNumber || "Auto-generated"}`);

    const requestBody = {
      customer_id: customerId,
      currency_code: currencyCode,
      line_items: lineItems,
      discount: discount,
      is_discount_before_tax: ZOHO_CONFIG.isDiscountBeforeTax,
      discount_type: "entity_level",
      is_inclusive_tax: ZOHO_CONFIG.isInclusiveTax,
      shipping_charge: shippingCharge,
      adjustment: adjustment,
      allow_partial_payments: allowPartialPayments,
      tax_treatment: ZOHO_CONFIG.taxTreatment,
    };

    // Add optional fields
    if (invoiceNumber) requestBody.invoice_number = invoiceNumber;
    if (referenceNumber) requestBody.reference_number = referenceNumber;
    if (date) requestBody.date = date;
    if (dueDate) requestBody.due_date = dueDate;
    if (notes) requestBody.notes = notes;
    if (terms) requestBody.terms = terms;
    if (adjustmentDescription)
      requestBody.adjustment_description = adjustmentDescription;
    if (paymentTerms) requestBody.payment_terms = paymentTerms;
    if (paymentTermsLabel) requestBody.payment_terms_label = paymentTermsLabel;

    const params = {};
    if (invoiceNumber) {
      params.ignore_auto_number_generation =
        ZOHO_CONFIG.ignoreAutoNumberGeneration;
    }

    // DEBUG: Log the full request body being sent to Zoho
    console.log("\n📤 [DEBUG] Full Invoice Request Body being sent to Zoho:");
    console.log(JSON.stringify(requestBody, null, 2));
    console.log("\n📤 [DEBUG] Line Items being sent:");
    if (requestBody.line_items && requestBody.line_items.length > 0) {
      requestBody.line_items.forEach((item, idx) => {
        console.log(`   Line Item ${idx + 1}:`);
        console.log(`      item_id: ${item.item_id || "NOT SET"}`);
        console.log(`      name: ${item.name || "NOT SET"}`);
        console.log(`      description: ${item.description || "NOT SET"}`);
        console.log(`      rate: ${item.rate}`);
        console.log(`      quantity: ${item.quantity}`);
        console.log(`      account_id: ${item.account_id || "NOT SET"}`);
      });
    }

    const response = await authenticatedRequest({
      method: "POST",
      url: ZOHO_CONFIG.endpoints.invoices,
      data: requestBody,
      params,
    });

    // DEBUG: Log the response from Zoho
    console.log("\n📥 [DEBUG] Zoho Invoice Creation Response:");
    console.log(`   Response Code: ${response.code}`);
    if (response.invoice) {
      console.log(`   Invoice ID: ${response.invoice.invoice_id}`);
      console.log(`   Invoice Number: ${response.invoice.invoice_number}`);
      console.log(`   Total: ${response.invoice.total}`);
      console.log(`   Line Items in Response:`);
      if (response.invoice.line_items) {
        response.invoice.line_items.forEach((item, idx) => {
          console.log(`      ${idx + 1}. ${item.name || item.description}`);
          console.log(`         item_id: ${item.item_id || "N/A"}`);
          console.log(`         account_id: ${item.account_id || "N/A"}`);
          console.log(`         account_name: ${item.account_name || "N/A"}`);
          console.log(`         tax_id: ${item.tax_id || "N/A"}`);
        });
      }
    }

    if (response.code === 0 && response.invoice) {
      console.log(
        `✅ Invoice created successfully: ${response.invoice.invoice_id}`,
      );
      console.log(`   Invoice Number: ${response.invoice.invoice_number}`);
      console.log(
        `   Total: ${response.invoice.currency_code} ${response.invoice.total}`,
      );
      return response.invoice;
    }

    throw new Error("Failed to create invoice - Invalid response");
  } catch (error) {
    console.error("❌ Error creating invoice:", error.message);
    throw {
      message: "Failed to create invoice",
      originalError: error,
      code: "INVOICE_CREATE_FAILED",
    };
  }
}

/**
 * Get invoice by ID
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<Object>} Invoice details
 */
async function getInvoiceById(invoiceId) {
  try {
    console.log(`🔍 Getting invoice: ${invoiceId}`);

    const response = await authenticatedRequest({
      method: "GET",
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}`,
    });

    if (response.code === 0 && response.invoice) {
      console.log(`✅ Invoice found: ${response.invoice.invoice_number}`);
      return response.invoice;
    }

    return null;
  } catch (error) {
    console.error("❌ Error getting invoice:", error.message);
    throw {
      message: "Failed to get invoice",
      originalError: error,
      code: "INVOICE_GET_FAILED",
    };
  }
}

/**
 * Search invoices by invoice number
 * @param {string} invoiceNumber - Invoice number to search
 * @returns {Promise<Array>} Array of matching invoices
 */
async function searchInvoiceByNumber(invoiceNumber) {
  try {
    console.log(`🔍 Searching for invoice: ${invoiceNumber}`);

    const response = await authenticatedRequest({
      method: "GET",
      url: ZOHO_CONFIG.endpoints.invoices,
      params: {
        invoice_number: invoiceNumber,
      },
    });

    if (response.code === 0 && response.invoices) {
      console.log(`✅ Found ${response.invoices.length} matching invoice(s)`);
      return response.invoices;
    }

    return [];
  } catch (error) {
    console.error("❌ Error searching invoice:", error.message);
    throw {
      message: "Failed to search invoice",
      originalError: error,
      code: "INVOICE_SEARCH_FAILED",
    };
  }
}

/**
 * List invoices with filters
 * @param {Object} filters - Query filters
 * @param {string} filters.customerId - Filter by customer
 * @param {string} filters.status - Filter by status (draft, sent, paid, etc.)
 * @param {string} filters.dateStart - Filter by date range start
 * @param {string} filters.dateEnd - Filter by date range end
 * @param {string} filters.referenceNumber - Filter by reference number (account number)
 * @param {number} filters.page - Page number
 * @param {number} filters.perPage - Results per page
 * @returns {Promise<Object>} Invoices list with pagination
 */
async function listInvoices(filters = {}) {
  try {
    const {
      customerId,
      status,
      dateStart,
      dateEnd,
      referenceNumber,
      page = 1,
      perPage = 50,
    } = filters;

    console.log(`📋 Fetching invoices (page ${page})...`);

    const params = {
      page,
      per_page: perPage,
      sort_column: "created_time",
      sort_order: "D", // Descending
    };

    if (customerId) params.customer_id = customerId;
    if (status) params.status = status;
    if (dateStart) params.date_start = dateStart;
    if (dateEnd) params.date_end = dateEnd;
    if (referenceNumber) params.reference_number = referenceNumber;

    const response = await authenticatedRequest({
      method: "GET",
      url: ZOHO_CONFIG.endpoints.invoices,
      params,
    });

    if (response.code === 0) {
      return {
        invoices: response.invoices || [],
        pageContext: response.page_context || {},
      };
    }

    return { invoices: [], pageContext: {} };
  } catch (error) {
    console.error("❌ Error listing invoices:", error.message);
    throw {
      message: "Failed to list invoices",
      originalError: error,
      code: "INVOICE_LIST_FAILED",
    };
  }
}

/**
 * Update existing invoice
 * @param {string} invoiceId - Zoho invoice ID
 * @param {Object} invoiceData - Invoice data to update
 * @returns {Promise<Object>} Updated invoice details
 */
async function updateInvoice(invoiceId, invoiceData) {
  try {
    console.log(`📝 Updating invoice: ${invoiceId}`);

    const response = await authenticatedRequest({
      method: "PUT",
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}`,
      data: invoiceData,
    });

    if (response.code === 0 && response.invoice) {
      console.log(`✅ Invoice updated successfully`);
      return response.invoice;
    }

    throw new Error("Failed to update invoice - Invalid response");
  } catch (error) {
    console.error("❌ Error updating invoice:", error.message);
    throw {
      message: "Failed to update invoice",
      originalError: error,
      code: "INVOICE_UPDATE_FAILED",
    };
  }
}

/**
 * Delete invoice
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteInvoice(invoiceId) {
  try {
    console.log(`🗑️  Deleting invoice: ${invoiceId}`);

    const response = await authenticatedRequest({
      method: "DELETE",
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}`,
    });

    if (response.code === 0) {
      console.log(`✅ Invoice deleted successfully`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("❌ Error deleting invoice:", error.message);
    throw {
      message: "Failed to delete invoice",
      originalError: error,
      code: "INVOICE_DELETE_FAILED",
    };
  }
}

/**
 * Mark invoice as sent
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<boolean>} True if marked successfully
 */
async function markInvoiceAsSent(invoiceId) {
  try {
    console.log(`📧 Marking invoice as sent: ${invoiceId}`);

    const response = await authenticatedRequest({
      method: "POST",
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}/status/sent`,
    });

    if (response.code === 0) {
      console.log(`✅ Invoice marked as sent`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("❌ Error marking invoice as sent:", error.message);
    throw {
      message: "Failed to mark invoice as sent",
      originalError: error,
      code: "INVOICE_MARK_SENT_FAILED",
    };
  }
}

/**
 * Void invoice
 * @param {string} invoiceId - Zoho invoice ID
 * @returns {Promise<boolean>} True if voided successfully
 */
async function voidInvoice(invoiceId) {
  try {
    console.log(`❌ Voiding invoice: ${invoiceId}`);

    const response = await authenticatedRequest({
      method: "POST",
      url: `${ZOHO_CONFIG.endpoints.invoices}/${invoiceId}/status/void`,
    });

    if (response.code === 0) {
      console.log(`✅ Invoice voided successfully`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("❌ Error voiding invoice:", error.message);
    throw {
      message: "Failed to void invoice",
      originalError: error,
      code: "INVOICE_VOID_FAILED",
    };
  }
}

/**
 * Map invoice data from your system to Zoho format
 * @param {Object} invoiceData - Invoice data from your system
 * @param {string} customerId - Zoho customer ID
 * @returns {Object} Invoice data formatted for Zoho
 */
function mapInvoiceToZohoFormat(invoiceData, customerId) {
  const {
    invoiceNumber,
    accountNumber,
    issueDate,
    dueDate,
    currency,
    items,
    facility,
    unit,
    notes,
    balanceBroughtForward,
    totalAmount,
    tax,
    subTotal,
  } = invoiceData;

  console.log(
    `\n📅 [DATE-MAPPING] Processing dates for invoice ${invoiceNumber}`,
  );
  console.log(`   Raw issueDate: ${issueDate} (type: ${typeof issueDate})`);
  console.log(`   Raw dueDate: ${dueDate} (type: ${typeof dueDate})`);

  // Format dates (YYYY-MM-DD)
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const formatted = date.toISOString().split("T")[0];
    console.log(`   Formatted: ${dateString} -> ${formatted}`);
    return formatted;
  };

  // Map line items
  const lineItems = items.map((item, index) => ({
    name: item.description || `Item ${index + 1}`,
    description: item.description || "",
    rate: item.unitPrice || 0,
    quantity: item.quantity || 1,
    item_order: index + 1,
  }));

  // Build notes section
  let invoiceNotes = "";
  if (facility?.name) invoiceNotes += `Property: ${facility.name}\n`;
  if (unit?.name) invoiceNotes += `Unit: ${unit.name}\n`;
  if (accountNumber) invoiceNotes += `Account Number: ${accountNumber}\n`;
  if (balanceBroughtForward && balanceBroughtForward !== 0) {
    invoiceNotes += `\nBalance Brought Forward: ${currency?.code || "KES"} ${balanceBroughtForward}\n`;
  }
  if (notes) invoiceNotes += `\n${notes}`;

  const formattedIssueDate = formatDate(issueDate);
  const formattedDueDate = formatDate(dueDate);

  console.log(`\n📅 [DATE-MAPPING] Final dates for Zoho:`);
  console.log(`   Zoho date (issueDate): ${formattedIssueDate}`);
  console.log(`   Zoho dueDate: ${formattedDueDate}`);

  // Validate dates
  if (formattedIssueDate && formattedDueDate) {
    const issueDateObj = new Date(formattedIssueDate);
    const dueDateObj = new Date(formattedDueDate);

    if (dueDateObj <= issueDateObj) {
      console.warn(
        `⚠️  [DATE-VALIDATION] Due date (${formattedDueDate}) is NOT after issue date (${formattedIssueDate})`,
      );
      console.warn(`   This will cause Zoho API to reject the invoice!`);
    } else {
      console.log(`✅ [DATE-VALIDATION] Due date is after issue date (valid)`);
    }
  }

  return {
    customerId,
    invoiceNumber,
    referenceNumber: accountNumber,
    date: formattedIssueDate,
    dueDate: formattedDueDate,
    currencyCode: currency?.code || "KES",
    lineItems,
    notes: invoiceNotes.trim(),
    terms:
      "Payment due by due date. Late payments may incur penalties as per lease agreement.",
    discount: 0,
    shippingCharge: 0,
    adjustment: 0,
    allowPartialPayments: true,
  };
}

/**
 * Check if invoice exists in Zoho
 * @param {string} invoiceNumber - Invoice number to check
 * @returns {Promise<Object|null>} Existing invoice or null
 */
async function checkInvoiceExists(invoiceNumber) {
  try {
    const existingInvoices = await searchInvoiceByNumber(invoiceNumber);

    if (existingInvoices && existingInvoices.length > 0) {
      console.log(`⚠️  Invoice ${invoiceNumber} already exists in Zoho`);
      return existingInvoices[0];
    }

    return null;
  } catch (error) {
    console.error("❌ Error checking invoice existence:", error.message);
    return null;
  }
}

/**
 * Create invoice and automatically apply customer credits if available
 * @param {Object} invoiceData - Invoice information
 * @param {Object} options - Options for credit application
 * @param {boolean} options.autoApplyCredits - Whether to auto-apply credits (default: true)
 * @param {number} options.maxCreditAmount - Max credit amount to apply (optional)
 * @returns {Promise<Object>} Created invoice with credit application details
 */
async function createInvoiceWithAutoCredit(invoiceData, options = {}) {
  try {
    const { autoApplyCredits = true, maxCreditAmount = null } = options;

    const customerId = invoiceData.customerId;

    console.log(`📄 Creating invoice with auto-credit application...`);

    // Step 1: Create the invoice
    const invoice = await createInvoice(invoiceData);

    if (!invoice) {
      throw new Error("Failed to create invoice");
    }

    const invoiceId = invoice.invoice_id;
    const invoiceBalance = parseFloat(invoice.balance || invoice.total || 0);

    console.log(`✅ Invoice created: ${invoice.invoice_number}`);
    console.log(
      `   Invoice Balance: ${invoice.currency_code} ${invoiceBalance}`,
    );

    // Step 2: Check if we should apply credits
    if (!autoApplyCredits || invoiceBalance <= 0) {
      console.log(`⏭️  Skipping credit application`);
      return {
        success: true,
        invoice,
        creditApplied: false,
        message: "Invoice created successfully",
      };
    }

    // Step 3: Get customer credits
    const {
      getCustomerUnusedCredits,
      applyCustomerCreditToInvoice,
    } = require("./customer");

    let creditsInfo;
    try {
      creditsInfo = await getCustomerUnusedCredits(customerId);
    } catch (error) {
      console.warn(`⚠️  Could not fetch customer credits: ${error.message}`);
      return {
        success: true,
        invoice,
        creditApplied: false,
        message: "Invoice created successfully (credits check failed)",
      };
    }

    if (!creditsInfo.hasCredits) {
      console.log(`💡 Customer has no unused credits`);
      return {
        success: true,
        invoice,
        creditApplied: false,
        availableCredits: 0,
        message: "Invoice created successfully (no credits available)",
      };
    }

    console.log(
      `💰 Customer has ${invoice.currency_code} ${creditsInfo.totalUnusedCredits} in credits`,
    );

    // Step 4: Apply credits to the invoice
    const amountToApply = maxCreditAmount
      ? Math.min(
          maxCreditAmount,
          creditsInfo.totalUnusedCredits,
          invoiceBalance,
        )
      : Math.min(creditsInfo.totalUnusedCredits, invoiceBalance);

    console.log(
      `💳 Applying ${invoice.currency_code} ${amountToApply} to invoice...`,
    );

    try {
      const creditResult = await applyCustomerCreditToInvoice({
        customerId,
        invoiceId,
        amount: amountToApply,
      });

      if (creditResult.success) {
        console.log(`✅ Credits applied successfully`);
        console.log(
          `   Amount Applied: ${invoice.currency_code} ${creditResult.amountApplied}`,
        );
        console.log(
          `   New Balance: ${invoice.currency_code} ${creditResult.newInvoiceBalance}`,
        );
        console.log(
          `   Remaining Credits: ${invoice.currency_code} ${creditResult.remainingCredits}`,
        );

        // Get updated invoice
        const updatedInvoice = await getInvoiceById(invoiceId);

        return {
          success: true,
          invoice: updatedInvoice || invoice,
          creditApplied: true,
          creditDetails: {
            amountApplied: creditResult.amountApplied,
            previousBalance: creditResult.previousInvoiceBalance,
            newBalance: creditResult.newInvoiceBalance,
            remainingCredits: creditResult.remainingCredits,
          },
          message: `Invoice created and ${invoice.currency_code} ${creditResult.amountApplied} credit applied`,
        };
      }
    } catch (error) {
      console.warn(`⚠️  Failed to apply credits: ${error.message}`);
      return {
        success: true,
        invoice,
        creditApplied: false,
        creditError: error.message,
        message: "Invoice created successfully (credit application failed)",
      };
    }

    return {
      success: true,
      invoice,
      creditApplied: false,
      message: "Invoice created successfully",
    };
  } catch (error) {
    console.error("❌ Error creating invoice with auto-credit:", error.message);
    throw {
      message: "Failed to create invoice with auto-credit",
      originalError: error,
      code: "INVOICE_CREATE_WITH_CREDIT_FAILED",
    };
  }
}

module.exports = {
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
  createInvoiceWithAutoCredit,
};
