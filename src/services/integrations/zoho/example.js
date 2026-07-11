/**
 * Zoho Books Integration - Example Usage
 *
 * This file demonstrates how to use the Zoho Books integration
 * to send invoices from your system to Zoho Books.
 */

const {
  sendInvoiceToZoho,
  bulkSendInvoicesToZoho,
  testZohoConnection
} = require('./send_invoice');

// ============================================================================
// Example 1: Test Zoho Connection
// ============================================================================

async function example1_testConnection() {
  console.log('=== Example 1: Test Zoho Connection ===\n');

  const result = await testZohoConnection();

  if (result.success) {
    console.log('✅ Connection successful!');
  } else {
    console.log('❌ Connection failed:', result.message);
  }

  return result;
}

// ============================================================================
// Example 2: Send Single Invoice (Basic)
// ============================================================================

async function example2_basicInvoice() {
  console.log('=== Example 2: Send Basic Invoice ===\n');

  // Sample invoice data matching your system's structure
  const invoiceData = {
    invoiceNumber: "LSE251009278",
    accountNumber: "6835021",
    client: {
      clientId: "68e774e8fa5bcf3bc73ed97d",
      firstName: "Simon",
      lastName: "Gichu"
    },
    facility: {
      id: "67e550c1d12f3f1b2e914fcc",
      name: "Knights Bridge"
    },
    unit: {
      id: "67e5a0cfd12f3f1b2e9151cc",
      name: "KB 46"
    },
    currency: {
      id: "67e642d14268ef4a9b998f61",
      name: "Kenyan Shilling",
      code: "KES"
    },
    items: [
      {
        description: "Monthly Rent - October 2025",
        quantity: 1,
        unitPrice: 8000
      },
      {
        description: "Security Deposit",
        quantity: 1,
        unitPrice: 8000
      }
    ],
    subTotal: 16000,
    tax: 0,
    totalAmount: 16000,
    amountPaid: 0,
    issueDate: "2025-10-09T08:41:16.097Z",
    dueDate: "2025-11-04T21:00:00.000Z",
    status: "Unpaid",
    balanceBroughtForward: 0,
    yearMonth: "2025-10"
  };

  try {
    const result = await sendInvoiceToZoho(invoiceData);

    if (result.success) {
      console.log('✅ Invoice sent successfully!');
      console.log('Customer:', result.data.customer.name);
      console.log('Invoice:', result.data.invoice.number);
      console.log('Total:', result.data.invoice.currency, result.data.invoice.total);
      console.log('Invoice URL:', result.data.invoice.url);
    } else {
      console.log('❌ Failed to send invoice:', result.message);
      console.log('Error details:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 3: Send Invoice with Payment (Paid Invoice)
// ============================================================================

async function example3_paidInvoice() {
  console.log('=== Example 3: Send Paid Invoice ===\n');

  const invoiceData = {
    invoiceNumber: "LSE251009279",
    accountNumber: "6835021",
    client: {
      clientId: "68e774e8fa5bcf3bc73ed97d",
      firstName: "Simon",
      lastName: "Gichu"
    },
    facility: {
      id: "67e550c1d12f3f1b2e914fcc",
      name: "Knights Bridge"
    },
    unit: {
      id: "67e5a0cfd12f3f1b2e9151cc",
      name: "KB 46"
    },
    currency: {
      id: "67e642d14268ef4a9b998f61",
      name: "Kenyan Shilling",
      code: "KES"
    },
    items: [
      {
        description: "Monthly Rent - November 2025",
        quantity: 1,
        unitPrice: 8000
      }
    ],
    subTotal: 8000,
    tax: 0,
    totalAmount: 8000,
    amountPaid: 8000,
    issueDate: "2025-11-09T08:41:16.097Z",
    dueDate: "2025-12-04T21:00:00.000Z",
    status: "Paid",
    paymentDetails: {
      paymentStatus: "Completed",
      paymentMethod: "M-PESA",
      paymentDate: "2025-11-09T16:23:14.234Z",
      transactionId: "TJ96G6WZNE"
    },
    reconciliationHistory: [
      {
        date: "2025-11-09T16:23:14.234Z",
        amount: 8000,
        type: "mpesa-transfer",
        paymentReference: "TJ96G6WZNE",
        notes: "MPESA payment"
      }
    ],
    balanceBroughtForward: 0,
    yearMonth: "2025-11"
  };

  try {
    // Send with payment recording enabled
    const result = await sendInvoiceToZoho(invoiceData, {
      recordPayment: true,
      markAsSent: true
    });

    if (result.success) {
      console.log('✅ Invoice and payment sent successfully!');
      console.log('Invoice:', result.data.invoice.number);
      console.log('Status:', result.data.invoice.status);
      if (result.data.payment) {
        console.log('Payment recorded:', result.data.payment.reference);
        console.log('Payment amount:', result.data.payment.amount);
      }
    } else {
      console.log('❌ Failed:', result.message);
    }

    return result;
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 4: Send Invoice with Options
// ============================================================================

async function example4_invoiceWithOptions() {
  console.log('=== Example 4: Send Invoice with Custom Options ===\n');

  const invoiceData = {
    invoiceNumber: "LSE251009280",
    accountNumber: "6835022",
    client: {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@example.com",
      phone: "+254712345678"
    },
    facility: {
      name: "Sunset Apartments"
    },
    unit: {
      name: "A12"
    },
    currency: {
      code: "KES"
    },
    items: [
      {
        description: "Monthly Rent",
        quantity: 1,
        unitPrice: 12000
      },
      {
        description: "Water Bill",
        quantity: 1,
        unitPrice: 500
      },
      {
        description: "Garbage Collection",
        quantity: 1,
        unitPrice: 300
      }
    ],
    subTotal: 12800,
    tax: 0,
    totalAmount: 12800,
    amountPaid: 0,
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Unpaid",
    balanceBroughtForward: 0
  };

  const options = {
    skipIfExists: true,      // Skip if invoice already exists
    recordPayment: false,     // Don't record payment (unpaid invoice)
    markAsSent: true         // Mark as sent immediately
  };

  try {
    const result = await sendInvoiceToZoho(invoiceData, options);

    if (result.success) {
      if (result.skipped) {
        console.log('⏭️  Invoice already exists, skipped');
      } else {
        console.log('✅ Invoice sent successfully!');
      }
      console.log('Result:', result.data);
    } else {
      console.log('❌ Failed:', result.message);
    }

    return result;
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 5: Bulk Send Multiple Invoices
// ============================================================================

async function example5_bulkSend() {
  console.log('=== Example 5: Bulk Send Invoices ===\n');

  const invoices = [
    {
      invoiceNumber: "LSE251009281",
      accountNumber: "6835023",
      client: { firstName: "John", lastName: "Smith" },
      currency: { code: "KES" },
      items: [{ description: "Rent", quantity: 1, unitPrice: 10000 }],
      totalAmount: 10000,
      amountPaid: 0,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Unpaid"
    },
    {
      invoiceNumber: "LSE251009282",
      accountNumber: "6835024",
      client: { firstName: "Mary", lastName: "Johnson" },
      currency: { code: "KES" },
      items: [{ description: "Rent", quantity: 1, unitPrice: 15000 }],
      totalAmount: 15000,
      amountPaid: 0,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Unpaid"
    }
  ];

  try {
    const results = await bulkSendInvoicesToZoho(invoices, {
      skipIfExists: true,
      markAsSent: true
    });

    console.log('\n📊 Bulk Send Results:');
    console.log(`Total: ${results.total}`);
    console.log(`Successful: ${results.successful}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Skipped: ${results.skipped}`);

    return results;
  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 6: Error Handling
// ============================================================================

async function example6_errorHandling() {
  console.log('=== Example 6: Error Handling ===\n');

  // Invalid invoice data (missing required fields)
  const invalidInvoiceData = {
    invoiceNumber: "INVALID-001",
    // Missing client, items, dates, etc.
  };

  try {
    const result = await sendInvoiceToZoho(invalidInvoiceData);

    if (!result.success) {
      console.log('❌ Validation failed as expected');
      console.log('Error:', result.message);
      console.log('Details:', result.error);

      if (result.error.details) {
        console.log('Validation errors:');
        result.error.details.forEach(err => console.log(`  - ${err}`));
      }
    }

    return result;
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// ============================================================================
// Example 7: Using with Express Route
// ============================================================================

function example7_expressRoute() {
  console.log('=== Example 7: Express Route Integration ===\n');

  const exampleCode = `
// In your Express route handler:
const { sendInvoiceToZoho } = require('./services/integrations/zoho/send_invoice');

router.post('/api/invoices/:id/send-to-zoho', async (req, res) => {
  try {
    // Get invoice from your database
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Send to Zoho Books
    const result = await sendInvoiceToZoho(invoice.toJSON(), {
      skipIfExists: true,
      recordPayment: true,
      markAsSent: true
    });

    if (result.success) {
      // Update invoice with Zoho ID
      invoice.zohoInvoiceId = result.data.invoice.id;
      invoice.zohoInvoiceNumber = result.data.invoice.number;
      invoice.syncedToZoho = true;
      invoice.syncedAt = new Date();
      await invoice.save();

      return res.json({
        success: true,
        message: 'Invoice sent to Zoho Books',
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});
  `;

  console.log(exampleCode);
}

// ============================================================================
// Main Runner
// ============================================================================

async function runExamples() {
  console.log('\n' + '='.repeat(80));
  console.log('ZOHO BOOKS INTEGRATION - EXAMPLES');
  console.log('='.repeat(80) + '\n');

  const examples = [
    { name: 'Test Connection', fn: example1_testConnection },
    { name: 'Basic Invoice', fn: example2_basicInvoice },
    { name: 'Paid Invoice', fn: example3_paidInvoice },
    { name: 'Invoice with Options', fn: example4_invoiceWithOptions },
    { name: 'Bulk Send', fn: example5_bulkSend },
    { name: 'Error Handling', fn: example6_errorHandling },
    { name: 'Express Route', fn: example7_expressRoute }
  ];

  // Run specific example or all
  const exampleToRun = process.argv[2]; // e.g., node example.js 1

  if (exampleToRun) {
    const index = parseInt(exampleToRun) - 1;
    if (index >= 0 && index < examples.length) {
      console.log(`Running Example ${exampleToRun}: ${examples[index].name}\n`);
      await examples[index].fn();
    } else {
      console.log('Invalid example number. Available examples:');
      examples.forEach((ex, i) => {
        console.log(`  ${i + 1}. ${ex.name}`);
      });
    }
  } else {
    console.log('Usage: node example.js [example_number]\n');
    console.log('Available examples:');
    examples.forEach((ex, i) => {
      console.log(`  ${i + 1}. ${ex.name}`);
    });
    console.log('\nExample: node example.js 1\n');
  }
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

// Export for use in other files
module.exports = {
  example1_testConnection,
  example2_basicInvoice,
  example3_paidInvoice,
  example4_invoiceWithOptions,
  example5_bulkSend,
  example6_errorHandling,
  example7_expressRoute
};
