const logger = require("../../../../config/winston");

const { getConfig, validateConfig } = require("./config");
const { getValidAccessToken, validateCredentials } = require("./auth");
const {
  getOrCreateCustomer,
  mapInvoiceClientToZohoCustomer,
} = require("./customer");
const {
  createInvoice,
  mapInvoiceToZohoFormat,
  checkInvoiceExists,
  markInvoiceAsSent,
} = require("./invoice");
const { recordInvoicePayment } = require("./payment");
const {
  autoApplyCreditsToNewInvoice,
  isEligibleForAutoCreditApplication,
} = require("./auto_credit_application");

const {
  getZohoItems,
  matchMultipleItems,
  convertToZohoLineItems,
} = require("./items/item_service");

const axios = require('axios')
// ============================================================================
// DEFAULT ZOHO CREDENTIALS (Fallback if DB credentials are missing/invalid)
// ============================================================================
const DEFAULT_ZOHO_CREDENTIALS = {
  clientId: '1000.85LKCF1P7LL243ZYNIIZZ8A2X3VZJY',
  clientSecret: '88b35138ce8a19182300666f7efe5e5169e83fafab',
  refreshToken: '1000.5b3cfb5757d0d27bfce4d40621e52ab8.30e07d376ae98ecdcf2a5ce62a12d788',
  accessToken: '1000.cdf62aaf3de43be62e8d2f0c909a95c6.407d46c851392b57816869230df59ab6',
  organizationId: '902250663',
};

/**
 * Send invoice to Zoho Books with Graceful Degradation
 *
 * This function attempts to send an invoice to Zoho Books but does NOT throw errors.
 * If the integration fails, it returns a failed result allowing your system to continue.
 *
 * IDEMPOTENCY: Safe to call multiple times with the same invoice number
 * GRACEFUL DEGRADATION: Failures don't break your system
 *
 * @param {Object} invoiceData - Invoice data from your system
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipIfExists - Skip if invoice already exists (default: true)
 * @param {boolean} options.recordPayment - Record payment if invoice is paid (default: true)
 * @param {boolean} options.markAsSent - Mark invoice as sent after creation (default: false)
 * @returns {Promise<Object>} Result object with invoice and payment details (never throws)
 *
 * @example
 * const result = await sendInvoiceToZoho(invoiceData, {
 *   skipIfExists: true,
 *   recordPayment: true,
 *   markAsSent: true
 * });
 *
 * if (result.success) {
 *   // Invoice synced successfully
 *   console.log('Zoho Invoice ID:', result.data.invoice.id);
 * } else {
 *   // Failed but your system continues
 *   console.error('Zoho sync failed:', result.message);
 * }
 */
async function sendInvoiceToZoho(invoiceData, options = {}) {
  const {
    skipIfExists = true,
    recordPayment = true,
    markAsSent = true,
  } = options;

  const result = {
    success: false,
    message: "",
    data: {
      customer: null,
      invoice: null,
      payment: null,
    },
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const startTime = Date.now(); // Move outside try block for catch access

  try {
    const invoiceNumber = invoiceData.invoiceNumber || "N/A";

    console.log("\n" + "=".repeat(80));
    console.log("🚀 Starting Zoho Books Invoice Integration");
    console.log("=".repeat(80));
    console.log(`   Invoice Number: ${invoiceNumber}`);
    console.log(
      `   Invoice Amount: ${invoiceData.totalAmount} ${invoiceData.currency?.code || "KES"}`,
    );
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log("=".repeat(80));

    // Log to Winston for production monitoring
    logger.info("Zoho Books integration started", {
      invoiceNumber,
      amount: invoiceData.totalAmount,
      customer: `${invoiceData.client?.firstName} ${invoiceData.client?.lastName}`,
      options,
    });

    // Apply default credentials to ZOHO_CONFIG if any critical field is missing
    // This ensures the system works even if DB credentials are not loaded
    const { ZOHO_CONFIG, updateAccessToken } = require('./config');
    const { updateRefreshToken, invalidateAccessToken } = require('./auth');

    if (!ZOHO_CONFIG.clientId || !ZOHO_CONFIG.clientSecret || !ZOHO_CONFIG.refreshToken) {
      console.log('⚠️  ZOHO_CONFIG missing credentials - applying hardcoded defaults');
      logger.warn('Applying default Zoho credentials as fallback');

      ZOHO_CONFIG.clientId = ZOHO_CONFIG.clientId || DEFAULT_ZOHO_CREDENTIALS.clientId;
      ZOHO_CONFIG.clientSecret = ZOHO_CONFIG.clientSecret || DEFAULT_ZOHO_CREDENTIALS.clientSecret;
      ZOHO_CONFIG.organizationId = ZOHO_CONFIG.organizationId || DEFAULT_ZOHO_CREDENTIALS.organizationId;

      // Fetch access token using refresh token
      const response = await axios.post(
        "https://accounts.zoho.com/oauth/v2/token",
        new URLSearchParams({
          refresh_token: ZOHO_CONFIG.refreshToken,
          client_id: ZOHO_CONFIG.clientId,
          client_secret: ZOHO_CONFIG.clientSecret,
          grant_type: "refresh_token",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      ZOHO_CONFIG.accessToken = response.data.access_token;

      // updateRefreshToken(DEFAULT_ZOHO_CREDENTIALS.refreshToken);
      // invalidateAccessToken(); // Force fresh token fetch using the default refresh token

      // console.log('✅ Default Zoho credentials applied');
    }

    // Step 1: Validate configuration
    console.log("\n📋 Step 1: Validating configuration...");
    logger.info("Validating Zoho configuration");
    try {
      validateConfig();
      console.log("✅ Configuration validated");
      logger.info("Zoho configuration valid");
    } catch (error) {
      logger.error("Zoho configuration invalid", { error: error.message });
      throw {
        message: "Invalid Zoho configuration - check environment variables",
        code: "CONFIG_INVALID",
        details: error.message,
      };
    }

    // Step 2: Validate Zoho credentials
    console.log("\n🔐 Step 2: Validating Zoho credentials...");
    logger.info("Validating Zoho credentials");
    const isValid = await validateCredentials();
    if (!isValid) {
      logger.error("Zoho credentials validation failed");
      throw {
        message:
          "Zoho credentials validation failed - check access token and refresh token",
        code: "CREDENTIALS_INVALID",
        details: "Unable to authenticate with Zoho Books API",
      };
    }
    console.log("✅ Credentials validated");
    logger.info("Zoho credentials validated successfully");

    // Step 3: Validate invoice data
    console.log("\n📝 Step 3: Validating invoice data...");
    logger.info("Validating invoice data", { invoiceNumber });
    const validation = validateInvoiceData(invoiceData);
    if (!validation.valid) {
      logger.error("Invoice data validation failed", {
        errors: validation.errors,
        invoiceNumber,
      });
      throw {
        message: "Invalid invoice data - missing required fields",
        code: "INVOICE_DATA_INVALID",
        details: validation.errors,
      };
    }
    console.log("✅ Invoice data validated");
    logger.info("Invoice data validated successfully", { invoiceNumber });

    // Step 4: Check if invoice already exists (IDEMPOTENCY)
    if (skipIfExists && invoiceData.invoiceNumber) {
      console.log(
        "\n🔍 Step 4: Checking if invoice already exists (idempotency check)...",
      );
      logger.info("Checking for existing invoice in Zoho", { invoiceNumber });

      try {
        const existingInvoice = await checkInvoiceExists(
          invoiceData.invoiceNumber,
        );

        if (existingInvoice) {
          console.log(
            `⚠️  Invoice ${invoiceData.invoiceNumber} already exists in Zoho (IDEMPOTENT)`,
          );
          logger.info(
            "Invoice already exists in Zoho - skipping (idempotent)",
            {
              invoiceNumber,
              zohoInvoiceId: existingInvoice.invoice_id,
            },
          );

          result.success = true;
          result.message =
            "Invoice already exists in Zoho Books (idempotent operation)";
          result.data.invoice = {
            id: existingInvoice.invoice_id,
            number: existingInvoice.invoice_number,
            total: existingInvoice.total,
            balance: existingInvoice.balance,
            status: existingInvoice.status,
            currency: existingInvoice.currency_code,
            url: existingInvoice.invoice_url,
          };
          result.skipped = true;
          return result;
        }
        console.log("✅ Invoice does not exist, proceeding with creation");
        logger.info("Invoice does not exist - proceeding with creation", {
          invoiceNumber,
        });
      } catch (error) {
        // Non-fatal: Continue with creation if check fails
        console.warn(
          "⚠️  Could not check for existing invoice, proceeding with creation",
        );
        logger.warn("Failed to check for existing invoice - continuing", {
          error: error.message,
          invoiceNumber,
        });
      }
    }

    // Step 5: Get or create customer
    console.log("\n👤 Step 5: Processing customer...");
    logger.info("Processing customer in Zoho", {
      customerName: `${invoiceData.client?.firstName} ${invoiceData.client?.lastName}`,
      invoiceNumber,
    });

    const customerData = mapInvoiceClientToZohoCustomer(invoiceData);
    const customer = await getOrCreateCustomer(customerData);

    if (!customer || !customer.contact_id) {
      logger.error("Failed to get or create customer in Zoho", {
        invoiceNumber,
      });
      throw {
        message: "Failed to get or create customer in Zoho",
        code: "CUSTOMER_FAILED",
        details: "No customer ID returned from Zoho API",
      };
    }

    console.log(
      `✅ Customer processed: ${customer.contact_name} (${customer.contact_id})`,
    );
    console.log(
      `   ${customer.isNew ? "Created new customer" : "Using existing customer"}`,
    );

    logger.info("Customer processed successfully", {
      customerId: customer.contact_id,
      customerName: customer.contact_name,
      isNew: customer.isNew,
      invoiceNumber,
    });

    result.data.customer = {
      id: customer.contact_id,
      name: customer.contact_name,
      isNew: customer.isNew,
    };

    // Step 6: Create invoice
    console.log("\n📄 Step 5.5: Matching items with Zoho Books items...");

    // Fetch Zoho items for matching (cached for 1 hour)
    let zohoItems = [];
    let matchedItems = [];

    try {
      zohoItems = await getZohoItems();
      console.log(`✅ Loaded ${zohoItems.length} item(s) from Zoho Books`);

      // Match PayServe items to Zoho items by 2-letter prefix
      if (invoiceData.items && invoiceData.items.length > 0) {
        matchedItems = matchMultipleItems(invoiceData.items, zohoItems);

        const matchedCount = matchedItems.filter((m) => m.matched).length;
        const totalCount = matchedItems.length;

        console.log(`📊 Item Matching Results:`);
        console.log(`   Matched: ${matchedCount}/${totalCount} item(s)`);

        matchedItems.forEach((match, idx) => {
          if (match.matched) {
            console.log(
              `   ✅ ${idx + 1}. "${match.original.description}" → "${match.zoho.name}"`,
            );
            console.log(`      Item ID: ${match.zoho.item_id}`);
            if (match.zoho.account_name) {
              console.log(
                `      Account: ${match.zoho.account_name} (ID: ${match.zoho.account_id})`,
              );
            }
            if (match.zoho.tax_name) {
              console.log(`      Tax: ${match.zoho.tax_name}`);
            }
          } else {
            console.log(
              `   ⚠️  ${idx + 1}. "${match.original.description}" → No match (before dash: ${match.prefix})`,
            );
          }
        });

        // Log expected journal entries
        console.log(
          `\n📒 Expected Journal Entries (Zoho will create automatically):`,
        );
        const totalAmount = matchedItems.reduce(
          (sum, m) => sum + (m.original.amount || 0),
          0,
        );
        console.log(
          `   DR: Accounts Receivable (Asset)        ${invoiceData.currency?.code || "KES"} ${totalAmount.toFixed(2)}`,
        );

        matchedItems.forEach((match) => {
          if (match.matched && match.zoho.account_name) {
            console.log(
              `     CR: ${match.zoho.account_name} (Revenue)         ${invoiceData.currency?.code || "KES"} ${match.original.amount.toFixed(2)}`,
            );
          }
        });
        console.log(
          `   (Tax entries will be created automatically by Zoho based on item tax settings)`,
        );
      }
    } catch (error) {
      console.warn(`⚠️  Failed to match items (non-fatal): ${error.message}`);
      logger.warn("Item matching failed, proceeding without item IDs", {
        error: error.message,
      });
      // Continue without item matching - invoice will still be created
    }

    console.log("\n📄 Step 6: Creating invoice in Zoho Books...");
    logger.info("Creating invoice in Zoho", {
      invoiceNumber,
      customerId: customer.contact_id,
      total: invoiceData.totalAmount,
    });

    // Map invoice data and include matched items if available
    const zohoInvoiceData = mapInvoiceToZohoFormat(
      invoiceData,
      customer.contact_id,
    );

    // Replace lineItems with matched items if we have matches
    // Note: mapInvoiceToZohoFormat returns lineItems (camelCase), createInvoice expects lineItems (camelCase)
    if (matchedItems.length > 0) {
      const zohoLineItems = convertToZohoLineItems(matchedItems);
      zohoInvoiceData.lineItems = zohoLineItems; // Must be camelCase to match createInvoice parameter
      console.log(
        `✅ Using ${matchedItems.filter((m) => m.matched).length} matched item(s) for double-entry bookkeeping`,
      );
      console.log(
        `   Line items with item_id will be sent to Zoho for proper account mapping`,
      );
    }
    const invoice = await createInvoice(zohoInvoiceData);

    if (!invoice || !invoice.invoice_id) {
      logger.error("Failed to create invoice in Zoho", { invoiceNumber });
      throw {
        message: "Failed to create invoice in Zoho Books",
        code: "INVOICE_CREATE_FAILED",
        details: "No invoice ID returned from Zoho API",
      };
    }

    console.log(`✅ Invoice created successfully`);
    console.log(`   Invoice ID: ${invoice.invoice_id}`);
    console.log(`   Invoice Number: ${invoice.invoice_number}`);
    console.log(`   Total: ${invoice.currency_code} ${invoice.total}`);
    console.log(`   Status: ${invoice.status}`);

    // Log double-entry bookkeeping confirmation
    if (matchedItems.length > 0 && matchedItems.some((m) => m.matched)) {
      console.log(`\n📚 Double-Entry Bookkeeping:`);
      console.log(`   ✅ Journal entries created automatically by Zoho Books`);
      console.log(
        `   ✅ Accounts Receivable debited: ${invoice.currency_code} ${invoice.total}`,
      );
      console.log(`   ✅ Revenue accounts credited based on matched items`);
      console.log(
        `   📊 View details in Zoho Books → Reports → General Ledger`,
      );
    }

    logger.info("Invoice created successfully in Zoho", {
      invoiceNumber: invoice.invoice_number,
      zohoInvoiceId: invoice.invoice_id,
      total: invoice.total,
      status: invoice.status,
    });

    result.data.invoice = {
      id: invoice.invoice_id,
      number: invoice.invoice_number,
      total: invoice.total,
      balance: invoice.balance,
      status: invoice.status,
      currency: invoice.currency_code,
      url: invoice.invoice_url,
    };

    // Step 6.5: Auto-apply customer credits if invoice has BBF - NON-FATAL
    // Note: Negative BBF means customer has credit (overpayment) from previous invoices
    const hasBBF =
      invoiceData.balanceBroughtForward &&
      invoiceData.balanceBroughtForward < 0;
    const hasAccountNumber = !!invoiceData.accountNumber;

    if (hasBBF && hasAccountNumber) {
      console.log(
        "\n💳 Step 6.5: Auto-applying customer credits for negative BBF...",
      );
      console.log(
        `   Invoice has credit BBF of ${invoiceData.currency?.code || "KES"} ${invoiceData.balanceBroughtForward}`,
      );
      console.log(`   Account Number: ${invoiceData.accountNumber}`);

      logger.info("Starting automatic credit application for BBF", {
        invoiceNumber,
        zohoInvoiceId: invoice.invoice_id,
        accountNumber: invoiceData.accountNumber,
        bbfAmount: invoiceData.balanceBroughtForward,
      });

      try {
        const creditResult = await autoApplyCreditsToNewInvoice({
          facilityId: invoiceData.facilityId,
          invoiceNumber: invoiceData.invoiceNumber,
          zohoInvoiceId: invoice.invoice_id,
          zohoCustomerId: customer.contact_id,
          accountNumber: invoiceData.accountNumber,
          bbfAmount: invoiceData.balanceBroughtForward,
          currencyCode: invoiceData.currency?.code || "KES",
        });

        if (creditResult.success && creditResult.creditsApplied > 0) {
          console.log(
            `✅ Automatically applied ${creditResult.creditsApplied} credit(s)`,
          );
          console.log(
            `   Total credit applied: ${invoiceData.currency?.code || "KES"} ${creditResult.totalAmountApplied}`,
          );
          console.log(
            `   Remaining BBF: ${invoiceData.currency?.code || "KES"} ${creditResult.remainingBBF}`,
          );

          logger.info("Credits automatically applied to invoice BBF", {
            invoiceNumber,
            creditsApplied: creditResult.creditsApplied,
            totalAmountApplied: creditResult.totalAmountApplied,
            remainingBBF: creditResult.remainingBBF,
          });

          // Update result with credit application info
          result.data.creditApplication = {
            creditsApplied: creditResult.creditsApplied,
            totalAmountApplied: creditResult.totalAmountApplied,
            originalBBF: invoiceData.balanceBroughtForward,
            remainingBBF: creditResult.remainingBBF,
            appliedCredits: creditResult.appliedCredits,
          };
        } else if (creditResult.creditsFound === 0) {
          console.log("ℹ️  No customer credits available to apply");
          logger.info("No customer credits available for BBF", {
            invoiceNumber,
          });
        } else {
          console.log("ℹ️  Credits found but not applied");
          logger.info("Credits found but not applied", {
            invoiceNumber,
            creditsFound: creditResult.creditsFound,
          });
        }
      } catch (error) {
        // NON-FATAL: Continue even if credit application fails
        console.warn(
          "⚠️  Failed to apply customer credits (non-fatal):",
          error.message,
        );
        logger.warn("Failed to apply customer credits (non-fatal)", {
          error: error.message,
          invoiceNumber,
          accountNumber: invoiceData.accountNumber,
        });
        result.errors.push({
          step: "auto_credit_application",
          message: error.message,
        });
      }
    } else if (hasBBF && !hasAccountNumber) {
      console.log(
        "⚠️  Invoice has BBF but no account number - skipping credit application",
      );
      logger.warn("Invoice has BBF but missing account number", {
        invoiceNumber,
        bbfAmount: invoiceData.balanceBroughtForward,
      });
    }

    // Step 7: Mark invoice as sent (if requested) - NON-FATAL
    // Check if status is not already "sent" or "paid" (case-insensitive)
    const invoiceStatus = (invoice.status || "").toLowerCase();
    const canMarkAsSent =
      invoiceStatus !== "sent" &&
      invoiceStatus !== "paid" &&
      invoiceStatus !== "void";

    // DEBUG: Log mark-as-sent decision
    console.log("\n🔍 DEBUG - Mark as Sent Check:");
    console.log(`   markAsSent option: ${markAsSent}`);
    console.log(`   Invoice status from Zoho: "${invoice.status}"`);
    console.log(`   Invoice status (lowercase): "${invoiceStatus}"`);
    console.log(`   canMarkAsSent: ${canMarkAsSent}`);
    console.log(`   Will mark as sent: ${markAsSent && canMarkAsSent}`);

    if (markAsSent && canMarkAsSent) {
      console.log("\n📧 Step 7: Marking invoice as sent...");
      logger.info("Marking invoice as sent in Zoho", {
        zohoInvoiceId: invoice.invoice_id,
        invoiceNumber,
      });

      console.log(`   Current status: "${invoice.status}"`);

      try {
        await markInvoiceAsSent(invoice.invoice_id);
        console.log("✅ Invoice marked as sent");
        logger.info("Invoice marked as sent successfully", {
          zohoInvoiceId: invoice.invoice_id,
          invoiceNumber,
        });
        result.data.invoice.status = "sent";
      } catch (error) {
        // NON-FATAL: Continue even if this fails
        console.warn("⚠️  Failed to mark invoice as sent:", error.message);
        logger.warn("Failed to mark invoice as sent (non-fatal)", {
          error: error.message,
          zohoInvoiceId: invoice.invoice_id,
          invoiceNumber,
        });
        result.errors.push({
          step: "mark_as_sent",
          message: error.message,
        });
      }
    }

    // Step 8: Record payment (if invoice is paid and requested) - NON-FATAL
    if (
      recordPayment &&
      (invoiceData.status === "Paid" || invoiceData.status === "Partially Paid")
    ) {
      console.log("\n💰 Step 8: Recording payment...");
      logger.info("Recording payment in Zoho", {
        zohoInvoiceId: invoice.invoice_id,
        invoiceNumber,
        amount: invoiceData.amountPaid || invoiceData.totalAmount,
      });

      try {
        const payment = await recordInvoicePayment(
          invoiceData,
          customer.contact_id,
          invoice.invoice_id,
        );

        if (payment) {
          console.log(`✅ Payment recorded successfully`);
          console.log(`   Payment ID: ${payment.payment_id}`);
          console.log(`   Amount: ${payment.amount}`);
          console.log(`   Reference: ${payment.reference_number}`);

          logger.info("Payment recorded successfully in Zoho", {
            paymentId: payment.payment_id,
            amount: payment.amount,
            reference: payment.reference_number,
            invoiceNumber,
          });

          result.data.payment = {
            id: payment.payment_id,
            amount: payment.amount,
            reference: payment.reference_number,
            date: payment.date,
          };
        } else {
          console.log("ℹ️  No payment to record");
          logger.info("No payment to record", { invoiceNumber });
        }
      } catch (error) {
        // NON-FATAL: Don't fail the whole process if payment recording fails
        console.warn(
          "⚠️  Failed to record payment (non-fatal):",
          error.message,
        );
        logger.warn("Failed to record payment (non-fatal)", {
          error: error.message,
          zohoInvoiceId: invoice.invoice_id,
          invoiceNumber,
        });
        result.errors.push({
          step: "record_payment",
          message: error.message,
        });
      }
    }

    // Success!
    const duration = Date.now() - startTime;
    result.success = true;
    result.message = "Invoice successfully sent to Zoho Books";

    console.log("\n" + "=".repeat(80));
    console.log("✅ INTEGRATION COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80));
    console.log(`   Customer: ${result.data.customer.name}`);
    console.log(`   Invoice: ${result.data.invoice.number}`);
    console.log(
      `   Total: ${result.data.invoice.currency} ${result.data.invoice.total}`,
    );
    if (result.data.payment) {
      console.log(
        `   Payment: ${result.data.payment.reference} - ${result.data.payment.amount}`,
      );
    }
    console.log(`   Duration: ${duration}ms`);
    console.log("=".repeat(80) + "\n");

    logger.info("Zoho Books integration completed successfully", {
      invoiceNumber,
      zohoInvoiceId: result.data.invoice.id,
      customerId: result.data.customer.id,
      total: result.data.invoice.total,
      duration,
      hasPayment: !!result.data.payment,
      hasErrors: result.errors.length > 0,
    });

    return result;
  } catch (error) {
    // GRACEFUL DEGRADATION: Log error but don't throw - allow system to continue
    const duration = Date.now() - startTime;

    console.error("\n" + "=".repeat(80));
    console.error("❌ ZOHO INTEGRATION FAILED (GRACEFUL DEGRADATION)");
    console.error("=".repeat(80));
    console.error("Error:", error.message || error);
    if (error.details) {
      console.error("Details:", error.details);
    }
    console.error(`Duration: ${duration}ms`);
    console.error("=".repeat(80));
    console.error("⚠️  YOUR SYSTEM CONTINUES TO WORK - Invoice saved locally");
    console.error("=".repeat(80) + "\n");

    // Log to Winston for monitoring and alerts
    logger.error("Zoho Books integration failed", {
      error: error.message || error,
      code: error.code,
      details: error.details,
      invoiceNumber: invoiceData.invoiceNumber || "N/A",
      duration,
      stack: error.stack,
    });

    result.success = false;
    result.message = error.message || "Failed to send invoice to Zoho Books";
    result.error = {
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || "An unexpected error occurred",
      details: error.details || error.originalError || null,
    };

    // IMPORTANT: Return result instead of throwing - this is graceful degradation
    return result;
  }
}

/**
 * Validate invoice data structure
 * @param {Object} invoiceData - Invoice data to validate
 * @returns {Object} Validation result
 */
function validateInvoiceData(invoiceData) {
  const errors = [];

  // Required fields
  if (
    !invoiceData.client ||
    !invoiceData.client.firstName ||
    !invoiceData.client.lastName
  ) {
    errors.push("Client information is required (firstName and lastName)");
  }

  if (
    !invoiceData.items ||
    !Array.isArray(invoiceData.items) ||
    invoiceData.items.length === 0
  ) {
    errors.push("At least one invoice item is required");
  }

  if (!invoiceData.totalAmount || invoiceData.totalAmount <= 0) {
    errors.push("Valid total amount is required");
  }

  if (!invoiceData.issueDate) {
    errors.push("Issue date is required");
  }

  if (!invoiceData.dueDate) {
    errors.push("Due date is required");
  }

  // Validate items
  if (invoiceData.items && Array.isArray(invoiceData.items)) {
    invoiceData.items.forEach((item, index) => {
      if (!item.description) {
        errors.push(`Item ${index + 1}: Description is required`);
      }
      if (!item.unitPrice || item.unitPrice <= 0) {
        errors.push(`Item ${index + 1}: Valid unit price is required`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Valid quantity is required`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Bulk send multiple invoices to Zoho Books with Graceful Degradation
 *
 * IDEMPOTENCY: Safe to call multiple times
 * GRACEFUL DEGRADATION: Failed invoices don't stop the batch
 *
 * @param {Array<Object>} invoices - Array of invoice data
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Summary of results (never throws)
 */
async function bulkSendInvoicesToZoho(invoices, options = {}) {
  const startTime = Date.now();
  console.log(`\n📦 Starting bulk invoice send: ${invoices.length} invoice(s)`);

  logger.info("Starting bulk invoice send to Zoho", {
    count: invoices.length,
    options,
  });

  const results = {
    total: invoices.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  for (let i = 0; i < invoices.length; i++) {
    console.log(`\n--- Processing invoice ${i + 1}/${invoices.length} ---`);

    try {
      const result = await sendInvoiceToZoho(invoices[i], options);

      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.successful++;
        }
      } else {
        results.failed++;
      }

      results.results.push({
        index: i,
        invoiceNumber: invoices[i].invoiceNumber,
        result,
      });
    } catch (error) {
      results.failed++;
      results.results.push({
        index: i,
        invoiceNumber: invoices[i].invoiceNumber,
        result: {
          success: false,
          message: error.message,
          error,
        },
      });
    }
  }

  const duration = Date.now() - startTime;

  console.log("\n" + "=".repeat(80));
  console.log("📊 BULK SEND SUMMARY");
  console.log("=".repeat(80));
  console.log(`   Total:      ${results.total}`);
  console.log(`   Successful: ${results.successful}`);
  console.log(`   Failed:     ${results.failed}`);
  console.log(`   Skipped:    ${results.skipped}`);
  console.log(`   Duration:   ${duration}ms`);
  console.log("=".repeat(80) + "\n");

  logger.info("Bulk invoice send completed", {
    total: results.total,
    successful: results.successful,
    failed: results.failed,
    skipped: results.skipped,
    duration,
  });

  return results;
}

/**
 * Test Zoho Books connection
 * @returns {Promise<Object>} Connection test result
 */
async function testZohoConnection() {
  try {
    console.log("🔍 Testing Zoho Books connection...\n");

    // Validate config
    validateConfig();
    console.log("✅ Configuration valid");

    // Test credentials
    const isValid = await validateCredentials();

    if (isValid) {
      console.log("✅ Connection successful\n");
      return {
        success: true,
        message: "Successfully connected to Zoho Books",
      };
    } else {
      console.log("❌ Connection failed\n");
      return {
        success: false,
        message: "Failed to connect to Zoho Books",
      };
    }
  } catch (error) {
    console.error("❌ Connection test failed:", error.message, "\n");
    return {
      success: false,
      message: error.message,
      error,
    };
  }
}

module.exports = {
  sendInvoiceToZoho,
  bulkSendInvoicesToZoho,
  testZohoConnection,
  validateInvoiceData,
};
