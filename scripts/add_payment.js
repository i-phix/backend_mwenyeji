/**
 * Add Payment to Invoice in Zoho Books
 *
 * This script adds a payment to an existing invoice using the API endpoints.
 *
 * Usage:
 *   npm run zoho:add-payment -- BULK17615597683783 1000 mpesa TJ96G6WZNE
 *   node scripts/add_payment.js BULK17615597683783 1000 mpesa TJ96G6WZNE
 *   node scripts/add_payment.js BULK17615597683783 3480 bank_transfer BT123456 --date=2025-10-27
 */

require("dotenv").config();
const axios = require("axios");

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const API_TIMEOUT = 30000; // 30 seconds

// =============================================================================
// Helper Functions
// =============================================================================

function printHeader(title) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function printSection(title) {
  console.log("\n" + title);
  console.log("-".repeat(80));
}

function formatCurrency(amount, currency = "KES") {
  return `${currency} ${parseFloat(amount).toLocaleString()}`;
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusEmoji(status) {
  const statusMap = {
    draft: "📝",
    sent: "📧",
    partially_paid: "💰",
    paid: "✅",
    overdue: "⚠️",
    void: "❌",
  };
  return statusMap[status.toLowerCase()] || "📄";
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

// =============================================================================
// API Functions
// =============================================================================

async function getInvoiceStatus(identifier, searchType = "number") {
  try {
    const url = `${API_BASE_URL}/api/integrations/zoho/invoices/${encodeURIComponent(identifier)}/status`;

    console.log(`🔗 Calling: GET ${url}`);

    const response = await axios.get(url, {
      params: { type: searchType },
      timeout: API_TIMEOUT,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 404) {
      return { success: false, error: "Invoice not found" };
    }

    if (!response.data.success) {
      return {
        success: false,
        error: response.data.error || response.data.message,
      };
    }

    return response.data;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to server at ${API_BASE_URL}. Is the server running?`,
      );
    }
    throw new Error(error.response?.data?.error || error.message);
  }
}

async function addPaymentToInvoice(paymentInfo) {
  try {
    const url = `${API_BASE_URL}/api/integrations/zoho/payments/add`;

    console.log(`🔗 Calling: POST ${url}`);
    console.log(`   Invoice ID: ${paymentInfo.invoiceId}`);
    console.log(`   Amount: ${paymentInfo.amount}`);

    const response = await axios.post(url, paymentInfo, {
      timeout: API_TIMEOUT,
      validateStatus: (status) => status < 500,
    });

    if (!response.data.success) {
      return {
        success: false,
        error: response.data.error || response.data.message,
      };
    }

    return response.data;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to server at ${API_BASE_URL}. Is the server running?`,
      );
    }
    throw new Error(error.response?.data?.error || error.message);
  }
}

async function getPaymentModes() {
  try {
    const url = `${API_BASE_URL}/api/integrations/zoho/payments/modes`;

    const response = await axios.get(url, {
      timeout: API_TIMEOUT,
      validateStatus: (status) => status < 500,
    });

    if (response.data.success && response.data.data) {
      return response.data.data.paymentModes;
    }

    return [];
  } catch (error) {
    console.error("Could not fetch payment modes:", error.message);
    return [];
  }
}

// =============================================================================
// Display Functions
// =============================================================================

function displayInvoiceInfo(invoice) {
  printSection("📄 Invoice Information");
  console.log(
    `Invoice Number:     ${invoice.invoice_number || invoice.number}`,
  );
  console.log(`Invoice ID:         ${invoice.invoice_id || invoice.id}`);
  console.log(
    `Customer:           ${invoice.customer_name || invoice.customerName}`,
  );
  console.log(
    `Customer ID:        ${invoice.customer_id || invoice.customerId}`,
  );
  console.log(
    `Status:             ${getStatusEmoji(invoice.status)} ${invoice.status.toUpperCase()}`,
  );
  console.log(`\nAmounts:`);
  console.log(
    `  Total:            ${formatCurrency(invoice.total, invoice.currency_code || invoice.currencyCode)}`,
  );
  console.log(
    `  Paid:             ${formatCurrency(invoice.payment_made || invoice.amountPaid || 0, invoice.currency_code || invoice.currencyCode)}`,
  );
  console.log(
    `  Balance:          ${formatCurrency(invoice.balance, invoice.currency_code || invoice.currencyCode)}`,
  );
}

function displayPaymentInfo(paymentInfo) {
  printSection("💳 Payment Details");
  console.log(`Amount:             ${formatCurrency(paymentInfo.amount)}`);
  console.log(`Payment Date:       ${formatDate(paymentInfo.paymentDate)}`);
  console.log(`Payment Mode:       ${paymentInfo.paymentMode}`);
  console.log(`Reference:          ${paymentInfo.referenceNumber}`);
  if (paymentInfo.description) {
    console.log(`Description:        ${paymentInfo.description}`);
  }
}

function displayResult(result) {
  printSection("✅ Payment Result");

  const { payment, invoice } = result.data;

  console.log(`Payment ID:         ${payment.id}`);
  console.log(`Payment Number:     ${payment.number}`);
  console.log(
    `Amount Paid:        ${formatCurrency(payment.amount, payment.currencyCode)}`,
  );
  console.log(`Payment Date:       ${formatDate(payment.date)}`);
  console.log(`Mode:               ${payment.mode}`);
  console.log(`Reference:          ${payment.reference}`);

  console.log(`\nUpdated Invoice:`);
  console.log(`  Invoice Number:   ${invoice.number}`);
  console.log(
    `  Status:           ${getStatusEmoji(invoice.status)} ${invoice.status.toUpperCase()}`,
  );
  console.log(
    `  Total:            ${formatCurrency(invoice.total, invoice.currencyCode)}`,
  );
  console.log(
    `  Amount Paid:      ${formatCurrency(invoice.amountPaid, invoice.currencyCode)}`,
  );
  console.log(
    `  New Balance:      ${formatCurrency(invoice.newBalance, invoice.currencyCode)}`,
  );

  if (invoice.isPaid) {
    console.log(`\n🎉 Invoice is now FULLY PAID!`);
  } else if (invoice.isPartiallyPaid) {
    const percentPaid = ((invoice.amountPaid / invoice.total) * 100).toFixed(2);
    console.log(`\n💰 Invoice is PARTIALLY PAID (${percentPaid}%)`);
    console.log(
      `   Remaining Balance: ${formatCurrency(invoice.newBalance, invoice.currencyCode)}`,
    );
  }
}

// =============================================================================
// Parse Arguments
// =============================================================================

function parseArguments(args) {
  const options = {
    invoiceIdentifier: null,
    amount: null,
    paymentMode: "mpesa",
    referenceNumber: null,
    customerId: null,
    paymentDate: getTodayDate(),
    description: null,
    notes: null,
    sendEmail: false,
  };

  // Parse positional arguments
  if (args.length >= 1) options.invoiceIdentifier = args[0];
  if (args.length >= 2) options.amount = parseFloat(args[1]);
  if (args.length >= 3) options.paymentMode = args[2];
  if (args.length >= 4) options.referenceNumber = args[3];

  // Parse optional flags
  args.forEach((arg) => {
    if (arg.startsWith("--customer=")) {
      options.customerId = arg.split("=")[1];
    } else if (arg.startsWith("--date=")) {
      options.paymentDate = arg.split("=")[1];
    } else if (arg.startsWith("--description=")) {
      options.description = arg.split("=")[1].replace(/^["']|["']$/g, "");
    } else if (arg.startsWith("--notes=")) {
      options.notes = arg.split("=")[1].replace(/^["']|["']$/g, "");
    } else if (arg === "--send-email") {
      options.sendEmail = true;
    }
  });

  return options;
}

// =============================================================================
// Main Function
// =============================================================================

async function addPayment(options) {
  try {
    printHeader("💰 Adding Payment to Invoice in Zoho Books");

    console.log(`\nAPI Server: ${API_BASE_URL}`);

    // Step 1: Find invoice
    console.log(`\n⏳ Finding invoice: ${options.invoiceIdentifier}`);

    // Determine search type
    const searchType =
      options.invoiceIdentifier.length > 15 &&
      /^\d+$/.test(options.invoiceIdentifier)
        ? "id"
        : "number";

    const statusResult = await getInvoiceStatus(
      options.invoiceIdentifier,
      searchType,
    );

    if (!statusResult.success) {
      console.error(`\n❌ Invoice not found: ${options.invoiceIdentifier}`);
      console.error("\nTips:");
      console.error("  - Check the invoice number/ID is correct");
      console.error("  - Make sure the invoice exists in Zoho Books");
      console.error(`  - Ensure server is running at ${API_BASE_URL}`);
      process.exit(1);
    }

    const invoice = statusResult.data.invoice;
    console.log("✅ Invoice found!");

    // Step 2: Display invoice info
    displayInvoiceInfo(invoice);

    // Step 3: Validate invoice status
    const status = (invoice.status || "").toLowerCase();
    if (status === "paid") {
      console.error(`\n❌ Invoice is already fully paid!`);
      console.error(
        `   Invoice Balance: ${formatCurrency(invoice.balance, invoice.currency_code || invoice.currencyCode)}`,
      );
      process.exit(1);
    }

    if (status === "void") {
      console.error(`\n❌ Invoice is void and cannot accept payments!`);
      process.exit(1);
    }

    // Step 4: Get customer ID from invoice if not provided
    const customerId =
      options.customerId || invoice.customer_id || invoice.customerId;

    // Step 5: Get invoice ID
    const invoiceId = invoice.invoice_id || invoice.id;

    // Step 6: Check payment amount and allow overpayments
    // Zoho Books supports overpayments - they create customer credits automatically
    const invoiceBalance = parseFloat(invoice.balance);
    if (options.amount > invoiceBalance) {
      const overpaymentAmount = options.amount - invoiceBalance;
      console.log(`\n⚠️  Overpayment detected!`);
      console.log(
        `   Payment Amount: ${formatCurrency(options.amount, invoice.currency_code || invoice.currencyCode)}`,
      );
      console.log(
        `   Invoice Balance: ${formatCurrency(invoiceBalance, invoice.currency_code || invoice.currencyCode)}`,
      );
      console.log(
        `   Overpayment: ${formatCurrency(overpaymentAmount, invoice.currency_code || invoice.currencyCode)}`,
      );
      console.log(
        "\n💰 This will create a customer credit in Zoho Books that can be applied to future invoices.",
      );
    }

    // Step 7: Generate reference number if not provided
    const referenceNumber =
      options.referenceNumber ||
      `${options.paymentMode.toUpperCase()}-${Date.now()}`;

    // Step 8: Prepare payment info
    const paymentInfo = {
      invoiceId: invoiceId,
      customerId: customerId,
      amount: options.amount,
      paymentDate: options.paymentDate,
      paymentMode: options.paymentMode,
      referenceNumber: referenceNumber,
      description:
        options.description ||
        `Payment for invoice ${invoice.invoice_number || invoice.number}`,
      notes: options.notes,
      sendEmail: options.sendEmail,
    };

    // Step 9: Display payment info
    displayPaymentInfo(paymentInfo);

    // Step 10: Confirm action
    const isFullPayment = options.amount === invoiceBalance;
    console.log(
      `\n${isFullPayment ? "✅" : "💰"} This will be a ${isFullPayment ? "FULL" : "PARTIAL"} payment.`,
    );
    if (!isFullPayment) {
      const remainingBalance = invoiceBalance - options.amount;
      console.log(
        `   Remaining balance after payment: ${formatCurrency(remainingBalance, invoice.currency_code || invoice.currencyCode)}`,
      );
    }

    // Step 11: Add payment via API
    console.log(`\n⏳ Adding payment to Zoho Books...`);
    const result = await addPaymentToInvoice(paymentInfo);

    if (!result.success) {
      console.error(`\n❌ Payment failed: ${result.error}`);
      process.exit(1);
    }

    console.log("✅ Payment added successfully!");

    // Step 12: Display result
    displayResult(result);

    printHeader("✅ Payment Added Successfully");

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("\n❌ Error adding payment:", error.message);

    if (error.response?.data) {
      console.error(
        "API Response:",
        JSON.stringify(error.response.data, null, 2),
      );
    }

    process.exit(1);
  }
}

// =============================================================================
// CLI Execution
// =============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   Add Payment to Invoice in Zoho Books                     ║
╚════════════════════════════════════════════════════════════════════════════╝

Usage:
  npm run zoho:add-payment -- <invoice> <amount> [mode] [reference] [options]
  node scripts/add_payment.js <invoice> <amount> [mode] [reference] [options]

Examples with Sample Invoices:
  # Add payment to Unit 3 invoice (KES 3,480.00)
  npm run zoho:add-payment -- BULK17615597683783 1000 mpesa TJ96G6WZNE

  # Add payment to Unit 2 invoice (KES 2,320.00)
  npm run zoho:add-payment -- BULK17615597683782 1000 bank_transfer BT123456

  # Add full payment to Unit 1 invoice (KES 1,160.00)
  npm run zoho:add-payment -- BULK17615597683781 1160 cash CASH-001

  # Add payment to idempotent test invoice (KES 5,800.00)
  npm run zoho:add-payment -- IDEMPOTENT1761559761521 2000 mpesa MP001

  # Add payment with custom date
  npm run zoho:add-payment -- BULK17615597683783 1500 mpesa MP001 --date=2025-10-27

  # Add payment with description
  npm run zoho:add-payment -- BULK17615597683783 3480 mpesa MP001 --description="Full payment for Unit 3"

  # Add payment using invoice ID
  npm run zoho:add-payment -- 7253014000000113050 1000 mpesa TJ96G6WZNE

Arguments:
  <invoice>           Invoice number (e.g., BULK17615597683783) or
                      Invoice ID (e.g., 7253014000000113050)
  <amount>            Payment amount (e.g., 1000)
  [mode]              Payment mode (default: mpesa)
  [reference]         Transaction reference (auto-generated if not provided)

Options:
  --customer=ID       Customer ID (auto-detected from invoice if not provided)
  --date=YYYY-MM-DD   Payment date (default: today)
  --description=TEXT  Payment description
  --notes=TEXT        Additional notes
  --send-email        Send payment receipt email to customer
  --server=URL        API server URL (default: http://localhost:3000)

Payment Modes:
  mpesa               M-Pesa mobile money
  bank_transfer       Bank transfer
  cash                Cash payment
  creditcard          Credit/debit card
  check               Cheque payment
  paypal              PayPal
  stripe              Stripe
  other               Other payment method

Sample Invoice Details:
  BULK17615597683783  - Unit 3: KES 3,480.00 (Due: 26/11/2025)
  BULK17615597683782  - Unit 2: KES 2,320.00 (Due: 26/11/2025)
  BULK17615597683781  - Unit 1: KES 1,160.00 (Due: 26/11/2025)
  IDEMPOTENT1761559761521 - Test: KES 5,800.00 (Due: 26/11/2025)

Examples with Options:
  # Full payment with all details
  npm run zoho:add-payment -- BULK17615597683783 3480 mpesa TJ96G6WZNE \\
    --date=2025-10-27 \\
    --description="October rent - full payment" \\
    --notes="Received via M-Pesa" \\
    --send-email

  # Partial payment
  npm run zoho:add-payment -- BULK17615597683782 1000 bank_transfer BT789 \\
    --description="First installment"

  # Cash payment
  npm run zoho:add-payment -- BULK17615597683781 500 cash CASH-001

View Payment Modes:
  npm run zoho:add-payment -- --modes

Environment Variables:
  API_BASE_URL        Base URL for API server (default: http://localhost:3000)

Note: Make sure your server is running at ${API_BASE_URL}
`);
    process.exit(0);
  }

  // Check for --modes flag
  if (args[0] === "--modes") {
    console.log("\n📋 Available Payment Modes:\n");
    getPaymentModes()
      .then((modes) => {
        if (modes.length > 0) {
          modes.forEach((mode) => {
            console.log(
              `  ${mode.code.padEnd(20)} ${mode.name.padEnd(20)} ${mode.description}`,
            );
          });
        } else {
          console.log(
            "  mpesa               M-Pesa              Mobile money payment",
          );
          console.log(
            "  bank_transfer       Bank Transfer       Direct bank transfer",
          );
          console.log("  cash                Cash                Cash payment");
          console.log(
            "  creditcard          Credit Card         Credit/Debit card payment",
          );
          console.log(
            "  check               Cheque              Cheque payment",
          );
          console.log(
            "  paypal              PayPal              PayPal payment",
          );
          console.log(
            "  stripe              Stripe              Stripe payment",
          );
          console.log(
            "  other               Other               Other payment method",
          );
        }
        console.log("\n");
        process.exit(0);
      })
      .catch((error) => {
        console.error("Error fetching payment modes:", error.message);
        process.exit(1);
      });
    return;
  }

  // Parse arguments
  const options = parseArguments(args);

  // Check for --server flag
  const serverArg = args.find((arg) => arg.startsWith("--server="));
  if (serverArg) {
    process.env.API_BASE_URL = serverArg.split("=")[1];
  }

  // Validate required arguments
  if (!options.invoiceIdentifier) {
    console.error("❌ Error: Invoice number/ID is required\n");
    console.error(
      "Usage: npm run zoho:add-payment -- <invoice> <amount> [mode] [reference]",
    );
    console.error(
      "Example: npm run zoho:add-payment -- BULK17615597683783 1000 mpesa TJ96G6WZNE\n",
    );
    process.exit(1);
  }

  if (!options.amount || isNaN(options.amount) || options.amount <= 0) {
    console.error("❌ Error: Valid payment amount is required\n");
    console.error(
      "Usage: npm run zoho:add-payment -- <invoice> <amount> [mode] [reference]",
    );
    console.error(
      "Example: npm run zoho:add-payment -- BULK17615597683783 1000 mpesa TJ96G6WZNE\n",
    );
    process.exit(1);
  }

  // Run the script
  addPayment(options)
    .then(() => {
      console.log("\n");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Fatal error:", error.message);
      process.exit(1);
    });
}

// Export for use as module
module.exports = { addPayment };
