/**
 * Get Invoice Details from Zoho Books
 *
 * This script retrieves invoice details from Zoho Books using the API endpoints.
 *
 * Usage:
 *   npm run zoho:get-invoice -- BULK17615597683783
 *   npm run zoho:get-invoice -- IDEMPOTENT1761559761521
 *   node scripts/get_invoice.js BULK17615597683783
 *   node scripts/get_invoice.js 7253014000000113050 --type=id
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

// =============================================================================
// API Functions
// =============================================================================

async function getInvoiceStatus(identifier, searchType = "number") {
  try {
    const url = `${API_BASE_URL}/api/integrations/zoho/invoices/${encodeURIComponent(identifier)}/status`;

    console.log(`🔗 Calling: GET ${url}`);
    console.log(`   Search Type: ${searchType}`);

    const response = await axios.get(url, {
      params: { type: searchType },
      timeout: API_TIMEOUT,
      validateStatus: (status) => status < 500, // Accept 4xx errors for better error messages
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

async function getPaymentHistory(invoiceId) {
  try {
    const url = `${API_BASE_URL}/api/integrations/zoho/invoices/${invoiceId}/payment-history`;

    console.log(`🔗 Calling: GET ${url}`);

    const response = await axios.get(url, {
      timeout: API_TIMEOUT,
      validateStatus: (status) => status < 500,
    });

    if (!response.data.success) {
      return null; // Payment history is optional
    }

    return response.data.data;
  } catch (error) {
    console.log("⚠️  Could not fetch payment history (optional)");
    return null;
  }
}

// =============================================================================
// Display Functions
// =============================================================================

function displayInvoiceDetails(invoice) {
  printSection("📄 Invoice Details");

  console.log(
    `Invoice Number:     ${invoice.invoice_number || invoice.number}`,
  );
  console.log(`Invoice ID:         ${invoice.invoice_id || invoice.id}`);
  console.log(
    `Status:             ${getStatusEmoji(invoice.status)} ${invoice.status.toUpperCase()}`,
  );
  console.log(
    `Customer:           ${invoice.customer_name || invoice.customerName}`,
  );
  console.log(
    `Customer ID:        ${invoice.customer_id || invoice.customerId}`,
  );

  console.log(`\nDates:`);
  console.log(
    `  Created:          ${formatDate(invoice.date || invoice.created_date)}`,
  );
  console.log(
    `  Due Date:         ${formatDate(invoice.due_date || invoice.dueDate)}`,
  );

  console.log(`\nAmounts:`);
  console.log(
    `  Subtotal:         ${formatCurrency(invoice.sub_total || invoice.subtotal, invoice.currency_code || invoice.currencyCode)}`,
  );

  if ((invoice.discount || 0) > 0) {
    console.log(
      `  Discount:         ${formatCurrency(invoice.discount, invoice.currency_code || invoice.currencyCode)}`,
    );
  }

  if ((invoice.tax_total || invoice.taxTotal || 0) > 0) {
    console.log(
      `  Tax:              ${formatCurrency(invoice.tax_total || invoice.taxTotal, invoice.currency_code || invoice.currencyCode)}`,
    );
  }

  console.log(
    `  Total:            ${formatCurrency(invoice.total, invoice.currency_code || invoice.currencyCode)}`,
  );
  console.log(
    `  Amount Paid:      ${formatCurrency(invoice.payment_made || invoice.amountPaid || 0, invoice.currency_code || invoice.currencyCode)}`,
  );
  console.log(
    `  Balance:          ${formatCurrency(invoice.balance, invoice.currency_code || invoice.currencyCode)}`,
  );

  if (invoice.reference_number || invoice.referenceNumber) {
    console.log(
      `\nReference:          ${invoice.reference_number || invoice.referenceNumber}`,
    );
  }

  if (invoice.notes) {
    console.log(`\nNotes:`);
    console.log(
      `  ${invoice.notes.substring(0, 200)}${invoice.notes.length > 200 ? "..." : ""}`,
    );
  }

  if (invoice.invoice_url || invoice.url) {
    console.log(`\nZoho URL:           ${invoice.invoice_url || invoice.url}`);
  }
}

function displayLineItems(invoice) {
  const lineItems = invoice.line_items || invoice.lineItems || [];

  if (lineItems.length === 0) return;

  printSection("📋 Line Items");

  console.log(
    `${"#".padEnd(3)} ${"Description".padEnd(40)} ${"Qty".padStart(6)} ${"Rate".padStart(12)} ${"Amount".padStart(12)}`,
  );
  console.log("-".repeat(80));

  lineItems.forEach((item, index) => {
    const desc = (item.name || item.description || "")
      .substring(0, 40)
      .padEnd(40);
    const qty = (item.quantity || 0).toString().padStart(6);
    const rate = parseFloat(item.rate || item.unitPrice || 0)
      .toLocaleString()
      .padStart(12);
    const amount = parseFloat(item.item_total || item.total || 0)
      .toLocaleString()
      .padStart(12);

    console.log(
      `${(index + 1).toString().padEnd(3)} ${desc} ${qty} ${rate} ${amount}`,
    );
  });
}

function displayPaymentHistory(history) {
  if (!history || !history.payments || history.payments.length === 0) {
    printSection("💰 Payments");
    console.log("No payments recorded for this invoice.");
    return;
  }

  printSection("💰 Payment History");

  const { invoice, paymentSummary, payments } = history;

  console.log(`Total Payments:     ${paymentSummary.totalPayments}`);
  console.log(
    `Total Amount Paid:  ${formatCurrency(paymentSummary.totalAmountPaid, invoice.currencyCode)}`,
  );
  console.log(`Percentage Paid:    ${paymentSummary.percentagePaid}%`);
  console.log(
    `Average Payment:    ${formatCurrency(paymentSummary.averagePaymentAmount, invoice.currencyCode)}`,
  );

  if (Object.keys(paymentSummary.paymentsByMode).length > 0) {
    console.log(`\nPayments by Mode:`);
    Object.entries(paymentSummary.paymentsByMode).forEach(([mode, data]) => {
      console.log(
        `  ${mode.padEnd(20)} ${data.count} payment(s) - ${formatCurrency(data.total, invoice.currencyCode)}`,
      );
    });
  }

  console.log(`\nPayment Transactions:`);
  console.log(
    `${"Date".padEnd(15)} ${"Mode".padEnd(15)} ${"Reference".padEnd(20)} ${"Amount".padStart(15)}`,
  );
  console.log("-".repeat(80));

  payments.forEach((payment) => {
    const date = formatDate(payment.date).padEnd(15);
    const mode = (payment.mode || "N/A").padEnd(15);
    const ref = (payment.reference || "N/A").substring(0, 20).padEnd(20);
    const amount = formatCurrency(
      payment.amount,
      invoice.currencyCode,
    ).padStart(15);

    console.log(`${date} ${mode} ${ref} ${amount}`);
  });
}

function displaySummary(invoice, history) {
  printSection("📊 Summary");

  const status = (invoice.status || "").toLowerCase();
  const isPaid = status === "paid";
  const isPartiallyPaid = status === "partially_paid";
  const isOverdue = status === "overdue";

  console.log(
    `Invoice Status:     ${getStatusEmoji(invoice.status)} ${invoice.status.toUpperCase()}`,
  );

  if (isPaid) {
    console.log(`✅ This invoice is FULLY PAID`);
  } else if (isPartiallyPaid) {
    const percentPaid = history ? history.paymentSummary.percentagePaid : 0;
    console.log(`💰 This invoice is PARTIALLY PAID (${percentPaid}%)`);
    console.log(
      `   Remaining Balance: ${formatCurrency(invoice.balance, invoice.currency_code || invoice.currencyCode)}`,
    );
  } else if (isOverdue) {
    console.log(`⚠️  This invoice is OVERDUE`);
    console.log(
      `   Amount Due: ${formatCurrency(invoice.balance, invoice.currency_code || invoice.currencyCode)}`,
    );
    console.log(
      `   Due Date: ${formatDate(invoice.due_date || invoice.dueDate)}`,
    );
  } else {
    console.log(`📄 This invoice is ${invoice.status.toUpperCase()}`);
    console.log(
      `   Total Amount: ${formatCurrency(invoice.total, invoice.currency_code || invoice.currencyCode)}`,
    );
  }
}

// =============================================================================
// Main Function
// =============================================================================

async function getInvoice(identifier, searchType = "auto") {
  try {
    printHeader("🔍 Fetching Invoice from Zoho Books");

    console.log(`\nSearching for: ${identifier}`);
    console.log(`API Server: ${API_BASE_URL}`);

    // Step 1: Determine search type if auto
    let finalSearchType = searchType;
    if (searchType === "auto") {
      // If identifier looks like an ID (long numeric string), use 'id', otherwise 'number'
      finalSearchType =
        identifier.length > 15 && /^\d+$/.test(identifier) ? "id" : "number";
    }

    // Step 2: Get invoice status
    console.log("\n⏳ Fetching invoice...");
    const statusResult = await getInvoiceStatus(identifier, finalSearchType);

    if (!statusResult.success) {
      console.error(`\n❌ ${statusResult.error || "Invoice not found"}`);
      console.error("\nTips:");
      console.error("  - Check the invoice number/ID is correct");
      console.error(
        "  - Try searching by invoice number (e.g., BULK17615597683783)",
      );
      console.error(
        "  - Try searching by invoice ID (e.g., 7253014000000113050)",
      );
      console.error("  - Use --type=id flag to force ID search");
      console.error(`  - Make sure server is running at ${API_BASE_URL}`);
      process.exit(1);
    }

    const invoice = statusResult.data.invoice;
    console.log("✅ Invoice found!");

    // Step 3: Display invoice details
    displayInvoiceDetails(invoice);
    displayLineItems(invoice);

    // Step 4: Get and display payment history
    console.log("\n⏳ Fetching payment history...");
    const invoiceId = invoice.invoice_id || invoice.id;
    const history = await getPaymentHistory(invoiceId);

    if (history) {
      displayPaymentHistory(history);
    } else {
      printSection("💰 Payments");
      console.log("No payment history available.");
    }

    // Step 5: Display summary
    displaySummary(invoice, history);

    printHeader("✅ Invoice Retrieved Successfully");

    return {
      success: true,
      invoice,
      history,
    };
  } catch (error) {
    console.error("\n❌ Error fetching invoice:", error.message);

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
║                   Get Invoice Details from Zoho Books                      ║
╚════════════════════════════════════════════════════════════════════════════╝

Usage:
  npm run zoho:get-invoice -- <invoice-number-or-id> [options]
  node scripts/get_invoice.js <invoice-number-or-id> [options]

Examples:
  # Sample invoices from your Zoho Books
  npm run zoho:get-invoice -- BULK17615597683783
  npm run zoho:get-invoice -- BULK17615597683782
  npm run zoho:get-invoice -- IDEMPOTENT1761559761521
  npm run zoho:get-invoice -- TEST1761559757906

  # By invoice ID
  npm run zoho:get-invoice -- 7253014000000113050

  # Force search type
  npm run zoho:get-invoice -- BULK17615597683783 --type=number
  npm run zoho:get-invoice -- 7253014000000113050 --type=id

Options:
  --type=number    Force search by invoice number
  --type=id        Force search by invoice ID
  --type=auto      Auto-detect (default)
  --server=URL     API server URL (default: http://localhost:3000)

Arguments:
  <invoice-number-or-id>    Invoice number (e.g., BULK17615597683783) or
                            Invoice ID (e.g., 7253014000000113050)

Environment Variables:
  API_BASE_URL              Base URL for API server (default: http://localhost:3000)

Examples with Sample Invoices:
  # Get invoice for Unit 3 (KES 3,480.00)
  npm run zoho:get-invoice -- BULK17615597683783

  # Get invoice for Unit 2 (KES 2,320.00)
  npm run zoho:get-invoice -- BULK17615597683782

  # Get invoice for Unit 1 (KES 1,160.00)
  npm run zoho:get-invoice -- BULK17615597683781

  # Get idempotent test invoice (KES 5,800.00)
  npm run zoho:get-invoice -- IDEMPOTENT1761559761521

Note: Make sure your server is running at ${API_BASE_URL}
`);
    process.exit(0);
  }

  const identifier = args[0];
  let searchType = "auto";
  let serverUrl = null;

  // Parse options
  args.forEach((arg) => {
    if (arg.startsWith("--type=")) {
      searchType = arg.split("=")[1];
    } else if (arg.startsWith("--server=")) {
      serverUrl = arg.split("=")[1];
    }
  });

  // Override API_BASE_URL if --server flag provided
  if (serverUrl) {
    process.env.API_BASE_URL = serverUrl;
  }

  // Run the script
  getInvoice(identifier, searchType)
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
module.exports = { getInvoice };
