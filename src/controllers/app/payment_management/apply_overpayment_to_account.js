/**
 * Apply Overpayment Credits to Account-Specific Invoices
 *
 * Business Logic:
 * - Customer in Zoho = Facility Name + Unit Name (e.g., "Building A - Unit 101")
 * - But invoices can be for different payers (landlord vs tenant) identified by account number
 * - Overpayment credits should only be applied to invoices with SAME account number
 * - Only apply to invoices that have Balance Brought Forward (BBF)
 *
 * This ensures landlord overpayments don't pay tenant invoices and vice versa.
 */

const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const axios = require('axios');

/**
 * Apply overpayment credit to invoices with same account number and BBF
 *
 * @param {Object} params - Application parameters
 * @param {string} params.facilityId - Facility ID
 * @param {string} params.accountNumber - Account number (identifies landlord vs tenant)
 * @param {number} params.overpaymentAmount - Amount of overpayment credit available
 * @param {string} params.sourceInvoiceNumber - Invoice that generated the overpayment
 * @param {string} params.paymentMode - Payment method (mpesa, cash, etc.)
 * @param {string} params.referenceNumber - Payment reference
 * @returns {Promise<Object>} Result with applied credits
 */
const applyOverpaymentToAccount = async (params) => {
  try {
    const {
      facilityId,
      accountNumber,
      overpaymentAmount,
      sourceInvoiceNumber,
      paymentMode = 'cash',
      referenceNumber,
    } = params;

    console.log('\n=== Apply Overpayment to Account-Specific Invoices ===');
    console.log(`Account Number: ${accountNumber}`);
    console.log(`Overpayment Amount: ${overpaymentAmount}`);
    console.log(`Source Invoice: ${sourceInvoiceNumber}`);

    if (!facilityId || !accountNumber || !overpaymentAmount) {
      throw new Error('Missing required parameters: facilityId, accountNumber, overpaymentAmount');
    }

    // Determine invoice type from account number prefix
    const prefix = accountNumber.charAt(0);
    let invoiceModel, invoiceType;
    let isWaterInvoice = false;
    let isVasInvoice = false;

    switch (prefix) {
      case '5':
      case '6':
        invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        invoiceType = 'invoice';
        break;
      case '7':
        invoiceModel = await getModel('WaterInvoice', payservedb.WaterInvoice.schema, facilityId);
        invoiceType = 'waterinvoice';
        isWaterInvoice = true;
        break;
      case '8':
        invoiceModel = await getModel('VasInvoice', payservedb.VasInvoice.schema, facilityId);
        invoiceType = 'vasinvoice';
        isVasInvoice = true;
        break;
      default:
        invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        invoiceType = 'invoice';
    }

    if (!invoiceModel) {
      throw new Error('Failed to get invoice model');
    }

    // Find unpaid invoices for this account number that have BBF
    console.log(`\n🔍 Finding unpaid invoices for account ${accountNumber} with BBF...`);

    const unpaidInvoices = await invoiceModel
      .find({
        accountNumber: accountNumber,
        status: { $in: ['Unpaid', 'Partially Paid', 'Overdue', 'Pending'] },
        balanceBroughtForward: { $gt: 0 }, // Only invoices with positive BBF
        invoiceNumber: { $ne: sourceInvoiceNumber }, // Exclude source invoice
      })
      .sort({ yearMonth: 1, issueDate: 1, createdAt: 1 }) // Chronological order
      .lean();

    console.log(`Found ${unpaidInvoices.length} unpaid invoices with BBF for account ${accountNumber}`);

    if (unpaidInvoices.length === 0) {
      console.log('⚠️  No eligible invoices found to apply overpayment credit');
      return {
        success: true,
        message: 'No eligible invoices found with BBF for this account number',
        creditsApplied: 0,
        remainingCredit: overpaymentAmount,
        invoices: [],
      };
    }

    // Calculate how much of the overpayment can be applied
    let remainingCredit = overpaymentAmount;
    const appliedCredits = [];

    console.log('\n💰 Applying credits to eligible invoices:');

    for (const invoice of unpaidInvoices) {
      if (remainingCredit <= 0) {
        console.log('✅ All overpayment credit has been applied');
        break;
      }

      // Calculate invoice balance
      const currentCharges = invoice.totalAmount || invoice.amount || 0;
      const bbf = invoice.balanceBroughtForward || 0;
      const paid = invoice.amountPaid || 0;
      const invoiceBalance = currentCharges + bbf - paid;

      if (invoiceBalance <= 0) {
        console.log(`⏭️  Skipping ${invoice.invoiceNumber} - already paid`);
        continue;
      }

      // Amount to apply to this invoice (lesser of remaining credit or invoice balance)
      const amountToApply = Math.min(remainingCredit, invoiceBalance);

      console.log(`\n📝 Invoice ${invoice.invoiceNumber}:`);
      console.log(`   Current Charges: ${currentCharges}`);
      console.log(`   BBF: ${bbf}`);
      console.log(`   Already Paid: ${paid}`);
      console.log(`   Balance: ${invoiceBalance}`);
      console.log(`   Applying: ${amountToApply}`);

      try {
        // Send payment to Zoho Books for this invoice
        console.log(`   🔄 Recording credit payment in Zoho Books...`);

        await axios.post(
          `${process.env.BACKEND_URL}/api/integrations/zoho/payments/record-by-number`,
          {
            facilityId: facilityId.toString(),
            invoiceNumber: invoice.invoiceNumber,
            amount: amountToApply,
            paymentMode: paymentMode,
            referenceNumber: referenceNumber || `CREDIT-${sourceInvoiceNumber}-${Date.now()}`,
            paymentDate: new Date().toISOString().split('T')[0],
            description: `Overpayment credit from ${sourceInvoiceNumber} - Applied to account ${accountNumber}`,
          }
        );

        console.log(`   ✅ Credit payment recorded in Zoho for ${invoice.invoiceNumber}`);

        // Update local invoice
        const newAmountPaid = paid + amountToApply;
        const newBalance = currentCharges + bbf - newAmountPaid;
        const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';

        await invoiceModel.findByIdAndUpdate(invoice._id, {
          $set: {
            amountPaid: newAmountPaid,
            status: newStatus,
            lastPaymentDate: new Date(),
          },
          $push: {
            reconciliationHistory: {
              date: new Date(),
              amount: amountToApply,
              type: 'overpayment_credit',
              paymentReference: referenceNumber || `CREDIT-${sourceInvoiceNumber}`,
              notes: `Overpayment credit from invoice ${sourceInvoiceNumber}`,
              paymentCompletion: newBalance <= 0 ? '100%' : `${((newAmountPaid / (currentCharges + bbf)) * 100).toFixed(2)}%`,
              remainingBalance: newBalance,
            },
          },
        });

        console.log(`   ✅ Local invoice updated - New balance: ${newBalance}`);

        appliedCredits.push({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice._id,
          amountApplied: amountToApply,
          previousBalance: invoiceBalance,
          newBalance: newBalance,
          status: newStatus,
          bbf: bbf,
        });

        remainingCredit -= amountToApply;

      } catch (error) {
        console.error(`   ❌ Failed to apply credit to ${invoice.invoiceNumber}:`, error.message);
        // Continue with next invoice even if one fails
      }
    }

    const totalApplied = overpaymentAmount - remainingCredit;

    console.log('\n=== Overpayment Credit Application Complete ===');
    console.log(`Total Credits Applied: ${totalApplied}`);
    console.log(`Remaining Credit: ${remainingCredit}`);
    console.log(`Invoices Updated: ${appliedCredits.length}`);
    console.log('===================================\n');

    return {
      success: true,
      message: totalApplied > 0
        ? `Successfully applied ${totalApplied} credits to ${appliedCredits.length} invoice(s)`
        : 'No credits applied',
      creditsApplied: totalApplied,
      remainingCredit: remainingCredit,
      invoices: appliedCredits,
      accountNumber: accountNumber,
      sourceInvoice: sourceInvoiceNumber,
    };

  } catch (error) {
    console.error('❌ Error applying overpayment to account:', error);
    throw {
      message: 'Failed to apply overpayment to account-specific invoices',
      error: error.message || error,
      code: 'OVERPAYMENT_APPLICATION_FAILED',
    };
  }
};

/**
 * Helper: Check if account has unpaid invoices with BBF that could receive credits
 *
 * @param {string} facilityId - Facility ID
 * @param {string} accountNumber - Account number
 * @returns {Promise<Object>} Information about eligible invoices
 */
const checkEligibleInvoicesForCredit = async (facilityId, accountNumber) => {
  try {
    // Determine invoice type
    const prefix = accountNumber.charAt(0);
    let invoiceModel;

    switch (prefix) {
      case '5':
      case '6':
        invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        break;
      case '7':
        invoiceModel = await getModel('WaterInvoice', payservedb.WaterInvoice.schema, facilityId);
        break;
      case '8':
        invoiceModel = await getModel('VasInvoice', payservedb.VasInvoice.schema, facilityId);
        break;
      default:
        invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
    }

    const eligibleInvoices = await invoiceModel
      .find({
        accountNumber: accountNumber,
        status: { $in: ['Unpaid', 'Partially Paid', 'Overdue', 'Pending'] },
        balanceBroughtForward: { $gt: 0 },
      })
      .sort({ yearMonth: 1, issueDate: 1 })
      .lean();

    let totalEligibleBalance = 0;
    const invoiceDetails = eligibleInvoices.map((inv) => {
      const balance =
        (inv.totalAmount || inv.amount || 0) +
        (inv.balanceBroughtForward || 0) -
        (inv.amountPaid || 0);
      totalEligibleBalance += balance;

      return {
        invoiceNumber: inv.invoiceNumber,
        balance: balance,
        bbf: inv.balanceBroughtForward,
        yearMonth: inv.yearMonth,
      };
    });

    return {
      accountNumber: accountNumber,
      hasEligibleInvoices: eligibleInvoices.length > 0,
      eligibleCount: eligibleInvoices.length,
      totalEligibleBalance: totalEligibleBalance,
      invoices: invoiceDetails,
    };
  } catch (error) {
    console.error('Error checking eligible invoices:', error);
    return {
      accountNumber: accountNumber,
      hasEligibleInvoices: false,
      eligibleCount: 0,
      totalEligibleBalance: 0,
      invoices: [],
      error: error.message,
    };
  }
};

module.exports = {
  applyOverpaymentToAccount,
  checkEligibleInvoicesForCredit,
};
