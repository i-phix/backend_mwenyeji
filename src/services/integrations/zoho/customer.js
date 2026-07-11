/**
 * Zoho Books Customer Management Module
 * Handles customer (contact) operations
 */

const { authenticatedRequest } = require("./auth");
const { ZOHO_CONFIG } = require("./config");
const logger = require("../../../../config/winston");

/**
 * Search for customer by name
 * @param {string} name - Customer name to search
 * @returns {Promise<Array>} Array of matching customers
 */
async function searchCustomerByName(name) {
  try {
    console.log(`🔍 Searching for customer: ${name}`);

    const response = await authenticatedRequest({
      method: "GET",
      url: ZOHO_CONFIG.endpoints.contacts,
      params: {
        contact_name_contains: name,
        contact_type: "customer",
      },
    });

    if (response.code === 0 && response.contacts) {
      console.log(`✅ Found ${response.contacts.length} matching customer(s)`);
      return response.contacts;
    }

    return [];
  } catch (error) {
    console.error("❌ Error searching customer:", error.message);
    throw {
      message: "Failed to search customer",
      originalError: error,
      code: "CUSTOMER_SEARCH_FAILED",
    };
  }
}

/**
 * Get customer by ID
 * @param {string} customerId - Zoho customer ID
 * @returns {Promise<Object>} Customer details
 */
async function getCustomerById(customerId) {
  try {
    console.log(`🔍 Getting customer by ID: ${customerId}`);

    const response = await authenticatedRequest({
      method: "GET",
      url: `${ZOHO_CONFIG.endpoints.contacts}/${customerId}`,
    });

    if (response.code === 0 && response.contact) {
      console.log(`✅ Customer found: ${response.contact.contact_name}`);
      return response.contact;
    }

    return null;
  } catch (error) {
    console.error("❌ Error getting customer:", error.message);
    throw {
      message: "Failed to get customer",
      originalError: error,
      code: "CUSTOMER_GET_FAILED",
    };
  }
}

/**
 * Create new customer in Zoho Books
 * @param {Object} customerData - Customer information
 * @param {string} customerData.firstName - Customer first name
 * @param {string} customerData.lastName - Customer last name
 * @param {string} customerData.email - Customer email (optional)
 * @param {string} customerData.phone - Customer phone (optional)
 * @param {string} customerData.currencyCode - Currency code (default: KES)
 * @returns {Promise<Object>} Created customer details
 */
async function createCustomer(customerData) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      mobile,
      currencyCode = ZOHO_CONFIG.defaultCurrency,
      companyName,
      address,
      city,
      state,
      zip,
      country,
    } = customerData;

    const contactName =
      companyName || `${firstName || ""} ${lastName || ""}`.trim();

    if (!contactName) {
      throw new Error(
        "Customer name is required (firstName + lastName or companyName)",
      );
    }

    console.log(`📝 Creating new customer: ${contactName}`);

    const requestBody = {
      contact_name: contactName,
      contact_type: "customer",
      customer_sub_type: companyName ? "business" : "individual",
      first_name: firstName || "",
      last_name: lastName || "",
      currency_code: currencyCode,
    };

    // Add optional fields if provided
    if (email) requestBody.email = email;
    if (phone) requestBody.phone = phone;
    if (mobile) requestBody.mobile = mobile;

    // Add billing address if provided
    if (address || city || state) {
      requestBody.billing_address = {
        address: address || "",
        city: city || "",
        state: state || "",
        zip: zip || "",
        country: country || "Kenya",
      };
    }

    const response = await authenticatedRequest({
      method: "POST",
      url: ZOHO_CONFIG.endpoints.contacts,
      data: requestBody,
    });

    if (response.code === 0 && response.contact) {
      console.log(
        `✅ Customer created successfully: ${response.contact.contact_id}`,
      );
      return response.contact;
    }

    throw new Error("Failed to create customer - Invalid response");
  } catch (error) {
    console.error("❌ Error creating customer:", error.message);
    throw {
      message: "Failed to create customer",
      originalError: error,
      code: "CUSTOMER_CREATE_FAILED",
    };
  }
}

/**
 * Update existing customer
 * @param {string} customerId - Zoho customer ID
 * @param {Object} customerData - Customer information to update
 * @returns {Promise<Object>} Updated customer details
 */
async function updateCustomer(customerId, customerData) {
  try {
    console.log(`📝 Updating customer: ${customerId}`);

    const response = await authenticatedRequest({
      method: "PUT",
      url: `${ZOHO_CONFIG.endpoints.contacts}/${customerId}`,
      data: customerData,
    });

    if (response.code === 0 && response.contact) {
      console.log(`✅ Customer updated successfully`);
      return response.contact;
    }

    throw new Error("Failed to update customer - Invalid response");
  } catch (error) {
    console.error("❌ Error updating customer:", error.message);
    throw {
      message: "Failed to update customer",
      originalError: error,
      code: "CUSTOMER_UPDATE_FAILED",
    };
  }
}

/**
 * Get or create customer (convenience method)
 * Searches for customer first, creates if not found
 * @param {Object} customerData - Customer information
 * @returns {Promise<Object>} Customer details with contact_id
 */
async function getOrCreateCustomer(customerData) {
  try {
    const { firstName, lastName, clientId } = customerData;
    const fullName = `${firstName || ""} ${lastName || ""}`.trim();

    if (!fullName) {
      throw new Error("Customer name is required (firstName and lastName)");
    }

    // Search for existing customer
    console.log(`🔍 Searching for existing customer: ${fullName}`);
    const existingCustomers = await searchCustomerByName(fullName);

    if (existingCustomers && existingCustomers.length > 0) {
      // Customer exists - return first match
      const customer = existingCustomers[0];
      console.log(`✅ Using existing customer: ${customer.contact_id}`);
      return {
        contact_id: customer.contact_id,
        contact_name: customer.contact_name,
        currency_code: customer.currency_code,
        isNew: false,
      };
    }

    // Customer doesn't exist - create new
    console.log(`📝 Customer not found. Creating new customer...`);
    const newCustomer = await createCustomer(customerData);

    return {
      contact_id: newCustomer.contact_id,
      contact_name: newCustomer.contact_name,
      currency_code: newCustomer.currency_code,
      isNew: true,
    };
  } catch (error) {
    console.error("❌ Error in getOrCreateCustomer:", error.message);
    throw {
      message: "Failed to get or create customer",
      originalError: error,
      code: "CUSTOMER_GET_OR_CREATE_FAILED",
    };
  }
}

/**
 * Map invoice client data to Zoho customer format
 * @param {Object} invoiceData - Invoice data from your system
 * @returns {Object} Customer data formatted for Zoho
 */
function mapInvoiceClientToZohoCustomer(invoiceData) {
  const { client, facility, unit, currency } = invoiceData;

  return {
    firstName: facility?.name || "",
    lastName: unit?.name || "",
    clientId: client?.clientId || "",
    email: client?.email || "",
    phone: client?.phone || "",
    mobile: client?.mobile || "",
    currencyCode: currency?.code || ZOHO_CONFIG.defaultCurrency,
    // Add any additional mapping as needed
  };
}

/**
 * List all customers with pagination
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.perPage - Results per page (default: 50)
 * @returns {Promise<Object>} Customers list with pagination info
 */
async function listCustomers(options = {}) {
  try {
    const { page = 1, perPage = 50 } = options;

    console.log(`📋 Fetching customers (page ${page})...`);

    const response = await authenticatedRequest({
      method: "GET",
      url: ZOHO_CONFIG.endpoints.contacts,
      params: {
        page,
        per_page: perPage,
        contact_type: "customer",
      },
    });

    if (response.code === 0) {
      return {
        contacts: response.contacts || [],
        pageContext: response.page_context || {},
      };
    }

    return { contacts: [], pageContext: {} };
  } catch (error) {
    console.error("❌ Error listing customers:", error.message);
    throw {
      message: "Failed to list customers",
      originalError: error,
      code: "CUSTOMER_LIST_FAILED",
    };
  }
}

/**
 * Get customer unused credits (available balance)
 * @param {string} customerId - Zoho customer ID
 * @returns {Promise<Object>} Customer credit details
 */
async function getCustomerUnusedCredits(customerId) {
  try {
    console.log(`💰 Getting unused credits for customer: ${customerId}`);
    logger.info("Fetching customer unused credits", { customerId });

    // Get customer payments that are not fully applied
    const response = await authenticatedRequest({
      method: "GET",
      url: `${ZOHO_CONFIG.endpoints.payments}`,
      params: {
        customer_id: customerId,
      },
    });

    if (response.code === 0 && response.customerpayments) {
      const payments = response.customerpayments;

      // Calculate total unused credits
      let totalUnusedCredits = 0;
      const unusedPayments = [];

      for (const payment of payments) {
        const amount = parseFloat(payment.amount || 0);
        const amountApplied = parseFloat(payment.amount_applied || 0);
        const unused = amount - amountApplied;

        if (unused > 0) {
          totalUnusedCredits += unused;
          unusedPayments.push({
            paymentId: payment.payment_id,
            paymentNumber: payment.payment_number,
            date: payment.date,
            amount: amount,
            amountApplied: amountApplied,
            unusedAmount: unused,
            paymentMode: payment.payment_mode,
            referenceNumber: payment.reference_number,
            description: payment.description,
          });
        }
      }

      console.log(`✅ Total unused credits: ${totalUnusedCredits}`);
      console.log(
        `   Found ${unusedPayments.length} payment(s) with unused credits`,
      );

      logger.info("Customer unused credits retrieved", {
        customerId,
        totalUnusedCredits,
        unusedPaymentsCount: unusedPayments.length,
      });

      return {
        success: true,
        customerId,
        totalUnusedCredits,
        unusedPayments,
        hasCredits: totalUnusedCredits > 0,
      };
    }

    console.log("⚠️  No payments found for customer");
    return {
      success: true,
      customerId,
      totalUnusedCredits: 0,
      unusedPayments: [],
      hasCredits: false,
    };
  } catch (error) {
    console.error("❌ Error getting customer unused credits:", error.message);
    logger.error("Failed to get customer unused credits", {
      error: error.message,
      customerId,
    });

    throw {
      message: "Failed to get customer unused credits",
      originalError: error,
      code: "CUSTOMER_CREDITS_GET_FAILED",
    };
  }
}

/**
 * Apply customer credit to an invoice
 * @param {Object} params - Application parameters
 * @param {string} params.customerId - Zoho customer ID
 * @param {string} params.invoiceId - Zoho invoice ID
 * @param {number} params.amount - Amount to apply (optional - will use max available)
 * @returns {Promise<Object>} Application result
 */
async function applyCustomerCreditToInvoice(params) {
  try {
    const { customerId, invoiceId, amount } = params;

    console.log(`💳 Applying customer credit to invoice ${invoiceId}`);
    logger.info("Applying customer credit to invoice", {
      customerId,
      invoiceId,
      requestedAmount: amount,
    });

    // Step 1: Get available credits
    const creditsInfo = await getCustomerUnusedCredits(customerId);

    if (!creditsInfo.hasCredits) {
      console.log("⚠️  Customer has no unused credits");
      return {
        success: false,
        message: "Customer has no unused credits available",
        availableCredits: 0,
      };
    }

    // Step 2: Get invoice details to check balance
    const { getInvoiceById } = require("./invoice");
    const invoice = await getInvoiceById(invoiceId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const invoiceBalance = parseFloat(invoice.balance || 0);

    if (invoiceBalance <= 0) {
      console.log("⚠️  Invoice is already fully paid");
      return {
        success: false,
        message: "Invoice is already fully paid",
        invoiceBalance: 0,
      };
    }

    // Step 3: Determine amount to apply
    const maxApplicable = Math.min(
      creditsInfo.totalUnusedCredits,
      invoiceBalance,
    );
    const amountToApply = amount
      ? Math.min(amount, maxApplicable)
      : maxApplicable;

    console.log(`   Available Credits: ${creditsInfo.totalUnusedCredits}`);
    console.log(`   Invoice Balance: ${invoiceBalance}`);
    console.log(`   Amount to Apply: ${amountToApply}`);

    // Step 4: Apply credits by creating a payment from existing credit
    // We'll use the first unused payment and apply it to the invoice
    const creditPayment = creditsInfo.unusedPayments[0];

    const applyData = {
      payment_id: creditPayment.paymentId,
      invoices: [
        {
          invoice_id: invoiceId,
          amount_applied: amountToApply,
        },
      ],
    };

    const response = await authenticatedRequest({
      method: "PUT",
      url: `${ZOHO_CONFIG.endpoints.payments}/${creditPayment.paymentId}`,
      data: applyData,
    });

    if (response.code === 0) {
      console.log(`✅ Customer credit applied successfully`);
      console.log(`   Amount Applied: ${amountToApply}`);
      console.log(
        `   Remaining Credits: ${creditsInfo.totalUnusedCredits - amountToApply}`,
      );

      logger.info("Customer credit applied to invoice", {
        customerId,
        invoiceId,
        amountApplied: amountToApply,
        remainingCredits: creditsInfo.totalUnusedCredits - amountToApply,
      });

      return {
        success: true,
        message: "Customer credit applied successfully",
        amountApplied: amountToApply,
        previousInvoiceBalance: invoiceBalance,
        newInvoiceBalance: invoiceBalance - amountToApply,
        remainingCredits: creditsInfo.totalUnusedCredits - amountToApply,
        paymentId: creditPayment.paymentId,
      };
    }

    throw new Error("Failed to apply credit - Invalid response from Zoho");
  } catch (error) {
    console.error("❌ Error applying customer credit:", error.message);
    logger.error("Failed to apply customer credit to invoice", {
      error: error.message,
      customerId: params.customerId,
      invoiceId: params.invoiceId,
    });

    throw {
      message: "Failed to apply customer credit",
      originalError: error,
      code: "CUSTOMER_CREDIT_APPLY_FAILED",
    };
  }
}

module.exports = {
  searchCustomerByName,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getOrCreateCustomer,
  mapInvoiceClientToZohoCustomer,
  listCustomers,
  getCustomerUnusedCredits,
  applyCustomerCreditToInvoice,
};
