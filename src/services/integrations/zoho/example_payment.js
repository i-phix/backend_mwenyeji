/**
 * Zoho Books Payment Functionality Examples
 *
 * This file contains practical examples for adding and managing
 * payments for invoices in Zoho Books.
 *
 * Usage:
 *   node src/services/integrations/zoho/example_payment.js
 */

const {
  addPaymentToInvoice,
  addMultiplePayments,
  getInvoicePayments,
  getPaymentHistory,
  deletePayment,
  updatePayment,
  getPaymentModes
} = require('./payment_advanced');

const { getInvoiceById } = require('./invoice');

// =============================================================================
// Example Configuration
// =============================================================================

// Replace these with actual IDs from your Zoho Books account
const EXAMPLE_INVOICE_ID = '7253014000000113050';
const EXAMPLE_CUSTOMER_ID = '7253014000000113002';
const EXAMPLE_PAYMENT_ID = '7253014000000115001';

// =============================================================================
// Example 1: Add a Full Payment to Invoice
// =============================================================================

async function example1_AddFullPayment() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 1: Add Full Payment to Invoice');
  console.log('='.repeat(80));

  try {
    const paymentInfo = {
      invoiceId: EXAMPLE_INVOICE_ID,
      customerId: EXAMPLE_CUSTOMER_ID,
      amount: 50000,
      paymentDate: new Date().toISOString().split('T')[0], // Today's date
      paymentMode: 'mpesa',
      referenceNumber: 'TJ96G6WZNE',
      description: 'Full payment via M-Pesa',
      notes: 'Payment received from customer John Doe',
      sendEmail: false
    };

    console.log('\n📤 Adding full payment...');
    console.log('Amount:', paymentInfo.amount);
    console.log('Mode:', paymentInfo.paymentMode);

    const result = await addPaymentToInvoice(paymentInfo);

    console.log('\n✅ Payment Added Successfully!');
    console.log('Payment ID:', result.data.payment.id);
    console.log('Payment Number:', result.data.payment.number);
    console.log('Invoice Status:', result.data.invoice.status);
    console.log('New Balance:', result.data.invoice.newBalance);

    return result;

  } catch (error) {
    console.error('\n❌ Example 1 Failed:', error.message);
    console.error('Details:', error.originalError || error);
  }
}

// =============================================================================
// Example 2: Add a Partial Payment to Invoice
// =============================================================================

async function example2_AddPartialPayment() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 2: Add Partial Payment to Invoice');
  console.log('='.repeat(80));

  try {
    const paymentInfo = {
      invoiceId: EXAMPLE_INVOICE_ID,
      customerId: EXAMPLE_CUSTOMER_ID,
      amount: 25000, // Half of 50,000 total
      paymentDate: '2025-10-22',
      paymentMode: 'bank_transfer',
      referenceNumber: 'BT-202510221234',
      description: 'Partial payment - First installment',
      notes: 'Customer will pay remaining balance next month'
    };

    console.log('\n📤 Adding partial payment...');
    console.log('Amount:', paymentInfo.amount);
    console.log('Mode:', paymentInfo.paymentMode);

    const result = await addPaymentToInvoice(paymentInfo);

    console.log('\n✅ Partial Payment Added!');
    console.log('Payment ID:', result.data.payment.id);
    console.log('Amount Paid:', result.data.invoice.amountPaid);
    console.log('Remaining Balance:', result.data.invoice.newBalance);
    console.log('Invoice Status:', result.data.invoice.status);
    console.log('Is Partially Paid?', result.data.invoice.isPartiallyPaid);

    return result;

  } catch (error) {
    console.error('\n❌ Example 2 Failed:', error.message);
    console.error('Details:', error.originalError || error);
  }
}

// =============================================================================
// Example 3: Add Multiple Payments (Installments)
// =============================================================================

async function example3_AddMultiplePayments() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 3: Add Multiple Installment Payments');
  console.log('='.repeat(80));

  try {
    const payments = [
      {
        amount: 15000,
        paymentDate: '2025-10-01',
        paymentMode: 'mpesa',
        referenceNumber: 'MP-OCT-001',
        description: 'October installment',
        notes: 'First month payment'
      },
      {
        amount: 15000,
        paymentDate: '2025-11-01',
        paymentMode: 'mpesa',
        referenceNumber: 'MP-NOV-001',
        description: 'November installment',
        notes: 'Second month payment'
      },
      {
        amount: 20000,
        paymentDate: '2025-12-01',
        paymentMode: 'cash',
        referenceNumber: 'CASH-DEC-001',
        description: 'December final payment',
        notes: 'Final installment - cash payment'
      }
    ];

    console.log(`\n📤 Adding ${payments.length} payments...`);
    payments.forEach((p, i) => {
      console.log(`Payment ${i + 1}: ${p.amount} via ${p.paymentMode} on ${p.paymentDate}`);
    });

    const result = await addMultiplePayments(
      EXAMPLE_INVOICE_ID,
      EXAMPLE_CUSTOMER_ID,
      payments
    );

    console.log('\n✅ Batch Payment Complete!');
    console.log('Total Payments:', result.total);
    console.log('Successful:', result.successful);
    console.log('Failed:', result.failed);

    if (result.successful > 0) {
      console.log('\n📋 Payment Details:');
      result.payments.forEach((p, i) => {
        if (p.success) {
          console.log(`  Payment ${i + 1}: ${p.data.payment.amount} - Status: ${p.data.invoice.status}`);
        }
      });
    }

    if (result.failed > 0) {
      console.log('\n⚠️ Failed Payments:');
      result.errors.forEach((e, i) => {
        console.log(`  Payment ${e.index + 1}: ${e.error}`);
      });
    }

    return result;

  } catch (error) {
    console.error('\n❌ Example 3 Failed:', error.message);
    console.error('Details:', error.originalError || error);
  }
}

// =============================================================================
// Example 4: Get All Payments for an Invoice
// =============================================================================

async function example4_GetInvoicePayments() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 4: Get All Payments for Invoice');
  console.log('='.repeat(80));

  try {
    console.log(`\n🔍 Fetching payments for invoice ${EXAMPLE_INVOICE_ID}...`);

    const payments = await getInvoicePayments(EXAMPLE_INVOICE_ID);

    console.log(`\n✅ Found ${payments.length} payment(s)`);

    if (payments.length > 0) {
      console.log('\n📋 Payment Details:');
      payments.forEach((payment, index) => {
        console.log(`\n  Payment ${index + 1}:`);
        console.log(`    ID: ${payment.id}`);
        console.log(`    Number: ${payment.number}`);
        console.log(`    Amount: ${payment.amount}`);
        console.log(`    Date: ${payment.date}`);
        console.log(`    Mode: ${payment.mode}`);
        console.log(`    Reference: ${payment.reference || 'N/A'}`);
        console.log(`    Description: ${payment.description || 'N/A'}`);
      });

      // Calculate total paid
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      console.log(`\n💰 Total Amount Paid: ${totalPaid}`);
    } else {
      console.log('\n⚠️ No payments found for this invoice');
    }

    return payments;

  } catch (error) {
    console.error('\n❌ Example 4 Failed:', error.message);
    console.error('Details:', error.originalError || error);
  }
}

// =============================================================================
// Example 5: Get Payment History Summary
// =============================================================================

async function example5_GetPaymentHistory() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 5: Get Payment History Summary');
  console.log('='.repeat(80));

  try {
    console.log(`\n📊 Fetching payment history for invoice ${EXAMPLE_INVOICE_ID}...`);

    const history = await getPaymentHistory(EXAMPLE_INVOICE_ID);

    console.log('\n✅ Payment History Retrieved!');
    console.log('\n📄 Invoice Details:');
    console.log(`  Number: ${history.invoice.number}`);
    console.log(`  Total: ${history.invoice.currencyCode} ${history.invoice.total}`);
    console.log(`  Paid: ${history.invoice.currencyCode} ${history.invoice.totalPaid}`);
    console.log(`  Balance: ${history.invoice.currencyCode} ${history.invoice.balance}`);
    console.log(`  Status: ${history.invoice.status}`);
    console.log(`  Is Paid? ${history.invoice.isPaid ? 'Yes' : 'No'}`);

    console.log('\n💰 Payment Summary:');
    console.log(`  Total Payments: ${history.paymentSummary.totalPayments}`);
    console.log(`  Total Amount Paid: ${history.invoice.currencyCode} ${history.paymentSummary.totalAmountPaid}`);
    console.log(`  Percentage Paid: ${history.paymentSummary.percentagePaid}%`);
    console.log(`  Average Payment: ${history.invoice.currencyCode} ${history.paymentSummary.averagePaymentAmount}`);

    console.log('\n📊 Payments by Mode:');
    Object.entries(history.paymentSummary.paymentsByMode).forEach(([mode, data]) => {
      console.log(`  ${mode.toUpperCase()}:`);
      console.log(`    Count: ${data.count}`);
      console.log(`    Total: ${history.invoice.currencyCode} ${data.total}`);
    });

    if (history.lastPayment) {
      console.log('\n🕐 Last Payment:');
      console.log(`  Date: ${history.lastPayment.date}`);
      console.log(`  Amount: ${history.invoice.currencyCode} ${history.lastPayment.amount}`);
      console.log(`  Mode: ${history.lastPayment.mode}`);
      console.log(`  Reference: ${history.lastPayment.reference || 'N/A'}`);
    }

    return history;

  } catch (error) {
    console.error('\n❌ Example 5 Failed:', error.message);
    console.error('Details:', error.originalError || error);
  }
}

// =============================================================================
// Example 6: Update Payment Details
// =============================================================================

async function example6_UpdatePayment() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 6: Update Payment Details');
  console.log('='.repeat(80));

  try {
    const updates = {
      amount: 30000,
      date: '2025-10-23',
      reference_number: 'UPDATED-MP-12345',
      description: 'Updated payment amount and reference'
    };

    console.log(`\n📝 Updating payment ${EXAMPLE_PAYMENT_ID}...`);
    console.log('Updates:', JSON.stringify(updates, null, 2));

    const updatedPayment = await updatePayment(EXAMPLE_PAYMENT_ID, updates);

    console.log('\n✅ Payment Updated Successfully!');
    console.log('Payment ID:', updatedPayment.payment_id);
    console.log('Payment Number:', updatedPayment.payment_number);
    console.log('New Amount:', updatedPayment.amount);
    console.log('New Date:', updatedPayment.date);

    return updatedPayment;

  } catch (error) {
    console.error('\n❌ Example 6 Failed:', error.message);
    console.error('Details:', error.originalError || error);
    console.log('\n⚠️ Note: Make sure EXAMPLE_PAYMENT_ID is set to a valid payment ID');
  }
}

// =============================================================================
// Example 7: Delete Payment
// =============================================================================

async function example7_DeletePayment() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 7: Delete Payment');
  console.log('='.repeat(80));

  try {
    console.log(`\n🗑️ Deleting payment ${EXAMPLE_PAYMENT_ID}...`);
    console.log('⚠️ WARNING: This will increase the invoice balance!');

    const result = await deletePayment(EXAMPLE_PAYMENT_ID);

    console.log('\n✅ Payment Deleted Successfully!');
    console.log('Payment ID:', result.paymentId);
    console.log('\n⚠️ Remember: Invoice balance has been increased');

    return result;

  } catch (error) {
    console.error('\n❌ Example 7 Failed:', error.message);
    console.error('Details:', error.originalError || error);
    console.log('\n⚠️ Note: Make sure EXAMPLE_PAYMENT_ID is set to a valid payment ID');
  }
}

// =============================================================================
// Example 8: Get Available Payment Modes
// =============================================================================

async function example8_GetPaymentModes() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 8: Get Available Payment Modes');
  console.log('='.repeat(80));

  try {
    console.log('\n🔍 Fetching available payment modes...');

    const modes = getPaymentModes();

    console.log(`\n✅ Found ${modes.length} payment modes:`);
    console.log('\n📋 Available Payment Modes:');
    modes.forEach((mode, index) => {
      console.log(`\n  ${index + 1}. ${mode.name} (${mode.code})`);
      console.log(`     ${mode.description}`);
    });

    return modes;

  } catch (error) {
    console.error('\n❌ Example 8 Failed:', error.message);
  }
}

// =============================================================================
// Example 9: Real-World Scenario - Invoice Payment Workflow
// =============================================================================

async function example9_RealWorldWorkflow() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 9: Real-World Payment Workflow');
  console.log('='.repeat(80));

  try {
    // Scenario: Customer paying rent in two installments

    console.log('\n📋 Scenario: Customer paying rent in two installments');
    console.log('Invoice Amount: KES 50,000');
    console.log('Payment Plan: Two installments of KES 25,000 each');

    // Step 1: Check current invoice status
    console.log('\n1️⃣ Checking invoice status...');
    const invoice = await getInvoiceById(EXAMPLE_INVOICE_ID);
    console.log(`   Current Balance: ${invoice.currency_code} ${invoice.balance}`);
    console.log(`   Status: ${invoice.status}`);

    // Step 2: Add first installment payment
    console.log('\n2️⃣ Recording first installment payment...');
    const firstPayment = {
      invoiceId: EXAMPLE_INVOICE_ID,
      customerId: EXAMPLE_CUSTOMER_ID,
      amount: 25000,
      paymentDate: '2025-10-15',
      paymentMode: 'mpesa',
      referenceNumber: 'MP-OCT15-12345',
      description: 'First installment - October rent'
    };

    const result1 = await addPaymentToInvoice(firstPayment);
    console.log(`   ✅ First payment recorded: ${result1.data.payment.id}`);
    console.log(`   New Balance: ${result1.data.invoice.currencyCode} ${result1.data.invoice.newBalance}`);
    console.log(`   Status: ${result1.data.invoice.status}`);

    // Step 3: Wait and add second installment
    console.log('\n3️⃣ Recording second installment payment...');
    const secondPayment = {
      invoiceId: EXAMPLE_INVOICE_ID,
      customerId: EXAMPLE_CUSTOMER_ID,
      amount: 25000,
      paymentDate: '2025-10-25',
      paymentMode: 'bank_transfer',
      referenceNumber: 'BT-OCT25-67890',
      description: 'Second installment - Final payment'
    };

    const result2 = await addPaymentToInvoice(secondPayment);
    console.log(`   ✅ Second payment recorded: ${result2.data.payment.id}`);
    console.log(`   New Balance: ${result2.data.invoice.currencyCode} ${result2.data.invoice.newBalance}`);
    console.log(`   Status: ${result2.data.invoice.status}`);
    console.log(`   Is Fully Paid? ${result2.data.invoice.isPaid ? 'Yes ✅' : 'No'}`);

    // Step 4: Get complete payment history
    console.log('\n4️⃣ Reviewing complete payment history...');
    const history = await getPaymentHistory(EXAMPLE_INVOICE_ID);
    console.log(`   Total Payments: ${history.paymentSummary.totalPayments}`);
    console.log(`   Total Paid: ${history.invoice.currencyCode} ${history.paymentSummary.totalAmountPaid}`);
    console.log(`   Final Status: ${history.invoice.status}`);

    console.log('\n✅ Payment Workflow Complete!');
    console.log('Invoice is now fully paid and settled.');

    return {
      firstPayment: result1,
      secondPayment: result2,
      history
    };

  } catch (error) {
    console.error('\n❌ Example 9 Failed:', error.message);
    console.error('Details:', error.originalError || error);
  }
}

// =============================================================================
// Main Function - Run All Examples
// =============================================================================

async function runAllExamples() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(15) + 'ZOHO BOOKS PAYMENT EXAMPLES' + ' '.repeat(36) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  console.log('\n⚠️  IMPORTANT: Update the following constants before running:');
  console.log('   - EXAMPLE_INVOICE_ID');
  console.log('   - EXAMPLE_CUSTOMER_ID');
  console.log('   - EXAMPLE_PAYMENT_ID (for update/delete examples)');

  // Uncomment the examples you want to run

  // await example1_AddFullPayment();
  // await example2_AddPartialPayment();
  // await example3_AddMultiplePayments();
  // await example4_GetInvoicePayments();
  // await example5_GetPaymentHistory();
  // await example6_UpdatePayment();
  // await example7_DeletePayment();
  await example8_GetPaymentModes();
  // await example9_RealWorldWorkflow();

  console.log('\n' + '='.repeat(80));
  console.log('Examples Complete!');
  console.log('='.repeat(80) + '\n');
}

// =============================================================================
// Run Examples
// =============================================================================

if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  });
}

// Export examples for use in other modules
module.exports = {
  example1_AddFullPayment,
  example2_AddPartialPayment,
  example3_AddMultiplePayments,
  example4_GetInvoicePayments,
  example5_GetPaymentHistory,
  example6_UpdatePayment,
  example7_DeletePayment,
  example8_GetPaymentModes,
  example9_RealWorldWorkflow
};
