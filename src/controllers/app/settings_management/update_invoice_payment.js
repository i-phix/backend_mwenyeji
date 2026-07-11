const mongoose = require("mongoose");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const axios = require("axios");
const { sendSms } = require("../../../utils/send_new_sms");

/**
 * Send SMS using the updated utility function
 */
async function sendSMS(facilityId, phoneNumber, message) {
  try {
    console.log(`Sending SMS to ${phoneNumber} via new SMS service`);
    const smsResponse = await sendSms(facilityId, phoneNumber, message);
    console.log("SMS Response:", smsResponse);
    if (smsResponse && smsResponse.success) {
      console.log(`SMS sent successfully to ${phoneNumber}`);
      return { success: true, result: smsResponse, method: "new_sms_service" };
    } else {
      console.warn(
        `SMS sending may have failed for ${phoneNumber}:`,
        smsResponse,
      );
      return {
        success: false,
        error: "SMS response indicates failure",
        result: smsResponse,
      };
    }
  } catch (smsError) {
    console.error(`Error sending SMS to ${phoneNumber}: ${smsError.message}`);
    return { success: false, error: smsError.message };
  }
}

/**
 * Calculate invoice balance
 */
const calculateInvoiceBalance = (invoice) => {
  const currentPeriodCharges =
    invoice.totalAmount ||
    invoice.amount ||
    invoice.charges?.totalMonthlyBill ||
    0;
  const bbf = invoice.balanceBroughtForward || 0;
  const paid = invoice.amountPaid || 0;

  const balance = currentPeriodCharges + bbf - paid;

  console.log(`Invoice ${invoice.invoiceNumber} balance:
        Current charges: ${currentPeriodCharges}
        BBF: ${bbf}
        Paid: ${paid}
        = Balance: ${balance}`);

  return Math.max(0, balance);
};

/**
 * Find unpaid invoices chronologically
 */
const findUnpaidInvoicesForAccount = async (
  accountNumber,
  invoiceType,
  facilityId,
  invoiceModel,
  isWaterInvoice = false,
  clientId = null,
  contractId = null,
) => {
  try {
    let query = {
      accountNumber: accountNumber,
      status: { $in: ["Unpaid", "Partially Paid", "Overdue", "Pending"] },
    };

    if (!isWaterInvoice && contractId) {
      query["whatFor.description"] = contractId;
    } else if (!isWaterInvoice && invoiceType) {
      query["whatFor.invoiceType"] = invoiceType;
    }

    if (isWaterInvoice && facilityId) {
      query.facilityId = facilityId;
    }

    const unpaidInvoices = await invoiceModel
      .find(query)
      .sort({ yearMonth: 1, issueDate: 1, createdAt: 1 })
      .lean();

    console.log(
      `Found ${unpaidInvoices.length} unpaid invoices for ${accountNumber}`,
    );

    return unpaidInvoices;
  } catch (error) {
    console.error("Error finding unpaid invoices:", error);
    return [];
  }
};

/**
 * Find the most recent invoice for an account (for overpayment handling)
 */
const findMostRecentInvoiceForAccount = async (
  accountNumber,
  invoiceType,
  facilityId,
  invoiceModel,
  isWaterInvoice = false,
  clientId = null,
  contractId = null,
) => {
  try {
    let query = {
      accountNumber: accountNumber,
    };

    if (!isWaterInvoice && contractId) {
      query["whatFor.description"] = contractId;
    } else if (!isWaterInvoice) {
      query["whatFor.invoiceType"] = invoiceType;
    }

    if (isWaterInvoice && facilityId) {
      query.facilityId = facilityId;
    }

    const recentInvoice = await invoiceModel
      .findOne(query)
      .sort({ yearMonth: -1, issueDate: -1, createdAt: -1 })
      .lean();

    if (recentInvoice) {
      console.log(
        `Found most recent invoice for overpayment: ${recentInvoice.invoiceNumber} (${recentInvoice.yearMonth})`,
      );
    } else {
      console.log(
        `No invoices found for account ${accountNumber} to apply overpayment`,
      );
    }

    return recentInvoice;
  } catch (error) {
    console.error("Error finding most recent invoice:", error);
    return null;
  }
};

/**
 * 🔧 COMPLETE FIXED VERSION - Replace the entire applyPaymentToInvoices function
 * Now with proper BBF cascading that works for 2, 3, 4+ invoices
 * This uses the same logic as the working version
 */
const applyPaymentToInvoices = (unpaidInvoices, totalPayment) => {
  let remainingPayment = totalPayment;
  const allocations = [];

    console.log(`\n=== Step 1: Calculate BBF reductions (with cascading) ===`);

  // Create working copy with adjusted BBF
  const adjustedInvoices = unpaidInvoices.map((inv) => ({ ...inv }));

    // 🔧 KEY FIX: Track BBF reductions that cascade to ALL future invoices
    let pendingBBFReduction = 0;

    // First pass: Simulate payment AND apply cascading BBF reductions
    let simulatedRemainingPayment = totalPayment;

  for (let i = 0; i < adjustedInvoices.length; i++) {
    const invoice = adjustedInvoices[i];

        // 🔧 CRITICAL FIX: Apply pending BBF reductions from previous invoices FIRST
        if (pendingBBFReduction > 0 && invoice.balanceBroughtForward > 0) {
            const originalBBF = invoice.balanceBroughtForward;
            const reduction = Math.min(pendingBBFReduction, invoice.balanceBroughtForward);
            invoice.balanceBroughtForward -= reduction;
            // DON'T subtract from pendingBBFReduction - it continues to ALL invoices

            console.log(`\n[CASCADE] ${invoice.invoiceNumber}: Applying BBF reduction from earlier payment`);
            console.log(`  Original BBF: ${originalBBF}`);
            console.log(`  Reduction: ${reduction}`);
            console.log(`  New BBF: ${invoice.balanceBroughtForward}`);
            console.log(`  Pending reduction continues: ${pendingBBFReduction}`);
        }

        // Now check if this invoice receives payment
        if (simulatedRemainingPayment <= 0) continue;

    const currentCharges =
      invoice.totalAmount ||
      invoice.amount ||
      invoice.charges?.totalMonthlyBill ||
      0;
    const bbf = invoice.balanceBroughtForward || 0;
    const previouslyPaid = invoice.amountPaid || 0;

    const invoiceBalance = currentCharges + bbf - previouslyPaid;

        console.log(
            `\n[PAYMENT] ${invoice.invoiceNumber}:`,
            `\n  Current charges: ${currentCharges}`,
            `\n  BBF (after cascade): ${bbf}`,
            `\n  Previously paid: ${previouslyPaid}`,
            `\n  Balance: ${invoiceBalance}`
        );

        if (invoiceBalance <= 0) {
            console.log(`  → Already paid, skipping`);
            continue;
        }

    const paymentToApply = Math.min(simulatedRemainingPayment, invoiceBalance);

    // Calculate breakdown
    let paidTowardsBBF = 0;
    let paidTowardsCurrentCharges = 0;

    if (bbf > 0) {
      const unpaidBBF = Math.max(0, bbf - previouslyPaid);
      paidTowardsBBF = Math.min(paymentToApply, unpaidBBF);
      paidTowardsCurrentCharges = paymentToApply - paidTowardsBBF;
    } else {
      paidTowardsCurrentCharges = paymentToApply;
    }

        console.log(`  → Applying payment: ${paymentToApply}`);
        console.log(`    • To BBF: ${paidTowardsBBF}`);
        console.log(`    • To current charges: ${paidTowardsCurrentCharges}`);

        // 🔧 KEY INSIGHT: Add this payment amount to pending BBF reduction
        // This reduction will apply to ALL subsequent invoices
        if (paymentToApply > 0) {
            pendingBBFReduction += paymentToApply;
            console.log(`  → Total BBF reduction for future invoices: ${pendingBBFReduction}`);
        }

    simulatedRemainingPayment -= paymentToApply;
  }

  console.log(`\n=== Step 2: Apply payment with adjusted BBF ===\n`);

    // Second pass: Apply actual payment with adjusted BBF
    for (const invoice of adjustedInvoices) {
        const originalBBF = unpaidInvoices.find(
            (inv) => inv._id.toString() === invoice._id.toString(),
        ).balanceBroughtForward || 0;

        const adjustedBBF = invoice.balanceBroughtForward || 0;
        const currentCharges =
            invoice.totalAmount ||
            invoice.amount ||
            invoice.charges?.totalMonthlyBill ||
            0;
        const previouslyPaid = invoice.amountPaid || 0;

        // Check if BBF changed (even if no payment applied to this specific invoice)
        const bbfChanged = adjustedBBF !== originalBBF;

        if (remainingPayment <= 0) {
            // Record BBF changes for unpaid invoices
            if (bbfChanged) {
                const newBalance = currentCharges + adjustedBBF - previouslyPaid;

                console.log(`${invoice.invoiceNumber}: BBF adjustment only`);
                console.log(`  Original BBF: ${originalBBF} → New BBF: ${adjustedBBF}`);
                console.log(`  New balance: ${newBalance}`);

                allocations.push({
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    yearMonth: invoice.yearMonth,
                    amountAllocated: 0,
                    paidTowardsBBF: 0,
                    paidTowardsCurrentCharges: 0,
                    previousBalance: currentCharges + originalBBF - previouslyPaid,
                    newBalance: newBalance,
                    newAmountPaid: previouslyPaid,
                    newStatus: invoice.status, // Keep existing status
                    originalBBF: originalBBF,
                    newBBFValue: adjustedBBF,
                    bbfChanged: true,
                    isBBFAdjustmentOnly: true, // Flag this as BBF-only change
                });
            }
            continue;
        }

    const invoiceBalance = currentCharges + adjustedBBF - previouslyPaid;

        console.log(`${invoice.invoiceNumber}:`);
        console.log(`  Current charges: ${currentCharges}`);
        console.log(`  Adjusted BBF: ${adjustedBBF} (was ${originalBBF})`);
        console.log(`  Previously paid: ${previouslyPaid}`);
        console.log(`  Balance: ${invoiceBalance}`);

        if (invoiceBalance <= 0) {
            console.log(`  → Already paid\n`);
            continue;
        }

    const paymentToApply = Math.min(remainingPayment, invoiceBalance);
    const newAmountPaid = previouslyPaid + paymentToApply;

    // Calculate breakdown
    let paidTowardsBBF = 0;
    let paidTowardsCurrentCharges = 0;

    if (adjustedBBF > 0) {
      const unpaidBBF = Math.max(0, adjustedBBF - previouslyPaid);
      paidTowardsBBF = Math.min(paymentToApply, unpaidBBF);
      paidTowardsCurrentCharges = paymentToApply - paidTowardsBBF;
    } else {
      paidTowardsCurrentCharges = paymentToApply;
    }

    const newBalance = invoiceBalance - paymentToApply;

    // Determine status
    let newStatus;
    if (newBalance <= 0) {
      newStatus = "Paid";
    } else if (newAmountPaid > 0) {
      newStatus = "Partially Paid";
    } else if (invoice.dueDate && new Date() > new Date(invoice.dueDate)) {
      newStatus = "Overdue";
    } else {
      newStatus = "Unpaid";
    }

        allocations.push({
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            yearMonth: invoice.yearMonth,
            amountAllocated: paymentToApply,
            paidTowardsBBF,
            paidTowardsCurrentCharges,
            previousBalance: currentCharges + adjustedBBF - previouslyPaid,
            newBalance,
            newAmountPaid,
            newStatus,
            originalBBF,
            newBBFValue: adjustedBBF,
            bbfChanged: bbfChanged,
            isBBFAdjustmentOnly: false,
        });

        console.log(`  ✓ Payment applied: ${paymentToApply}`);
        console.log(`    • To BBF: ${paidTowardsBBF}`);
        console.log(`    • To current: ${paidTowardsCurrentCharges}`);
        console.log(`    • New balance: ${newBalance}`);
        console.log(`    • New status: ${newStatus}`);
        if (bbfChanged) {
            console.log(`    • BBF updated: ${originalBBF} → ${adjustedBBF}`);
        }
        console.log('');

    remainingPayment -= paymentToApply;
  }

  return { allocations, remainingPayment };
};

/**
 * Handle overpayment when no unpaid invoices exist
 */
const handleOverpaymentOnly = async (
  accountNumber,
  totalPayment,
  invoiceModel,
  mostRecentInvoice,
  transactionId,
  facilityId,
) => {
  console.log(`\n=== Handling Overpayment Only ===`);
  console.log(
    `No unpaid invoices found. Applying ${totalPayment} as overpayment to most recent invoice`,
  );

  const updatedInvoices = [];
  const allocations = [];
  let glEntryRecordId = null;

  if (mostRecentInvoice) {
    // GL entry for overpayment
    try {
      const doubleEntryModel = await getModel(
        "GLAccountDoubleEntries",
        payservedb.GLAccountDoubleEntries.schema,
        facilityId,
      );

      if (
        mostRecentInvoice &&
        doubleEntryModel &&
        mostRecentInvoice.paymentDoubleEntryAccount
      ) {
        const glEntryData = await processPaymentGLEntry(
          mostRecentInvoice,
          doubleEntryModel,
          totalPayment,
          transactionId,
          facilityId,
          "mpesa-transfer",
        );
        if (glEntryData) {
          const glEntry = await doubleEntryModel.create(glEntryData);
          glEntryRecordId = glEntry._id;
        }
      }
    } catch (glError) {
      console.error("Error processing GL entry for overpayment:", glError);
    }

    // Record overpayment on the most recent invoice
    const updateObj = {
      $set: {
        overpay: totalPayment,
        paymentMethod: "mpesa-transfer",
        lastPaymentDate: new Date(),
        transactionReference: transactionId,
      },
      $push: {
        reconciliationHistory: {
          date: new Date(),
          amount: totalPayment,
          type: "overpayment",
          paymentReference: transactionId,
          notes: `Full MPESA payment recorded as overpayment - no unpaid invoices`,
          paymentCompletion: "100%",
          remainingBalance: 0,
          glEntryId: glEntryRecordId,
        },
      },
    };

    if (!mostRecentInvoice.invoiceNumber.startsWith("WTR-")) {
      updateObj.$set["paymentDetails.paymentStatus"] = "Completed";
      updateObj.$set["paymentDetails.paymentMethod"] = "mpesa-transfer";
      updateObj.$set["paymentDetails.paymentDate"] = new Date();
      updateObj.$set["paymentDetails.transactionId"] = transactionId;
    }

    const updatedInvoice = await invoiceModel.findByIdAndUpdate(
      mostRecentInvoice._id,
      updateObj,
      { new: true },
    );

    if (updatedInvoice) {
      updatedInvoices.push(updatedInvoice);

      // Create a dummy allocation for response consistency
      allocations.push({
        invoiceId: mostRecentInvoice._id,
        invoiceNumber: mostRecentInvoice.invoiceNumber,
        yearMonth: mostRecentInvoice.yearMonth,
        amountAllocated: 0,
        paidTowardsBBF: 0,
        paidTowardsCurrentCharges: 0,
        previousBalance: 0,
        newBalance: 0,
        newAmountPaid: mostRecentInvoice.amountPaid || 0,
        newStatus: mostRecentInvoice.status || "Paid",
        originalBBF: mostRecentInvoice.balanceBroughtForward || 0,
        newBBFValue: mostRecentInvoice.balanceBroughtForward || 0,
        bbfChanged: false,
        transactionId: transactionId,
        isOverpaymentOnly: true,
      });
    }

    console.log(
      `✓ Overpayment of ${totalPayment} recorded on invoice: ${mostRecentInvoice.invoiceNumber}`,
    );
  } else {
    console.log(
      `⚠️ No recent invoice found to record overpayment. Payment will be recorded as overpayment only.`,
    );

    // Create a minimal allocation for response
    allocations.push({
      invoiceId: null,
      invoiceNumber: "OVERPAYMENT-ONLY",
      yearMonth: new Date().toISOString().slice(0, 7),
      amountAllocated: 0,
      paidTowardsBBF: 0,
      paidTowardsCurrentCharges: 0,
      previousBalance: 0,
      newBalance: 0,
      newAmountPaid: 0,
      newStatus: "Overpayment",
      originalBBF: 0,
      newBBFValue: 0,
      bbfChanged: false,
      transactionId: transactionId,
      isOverpaymentOnly: true,
    });
  }

  return {
    allocations,
    remainingPayment: totalPayment,
    updatedInvoices,
    glEntryRecordId,
    isOverpaymentOnly: true,
  };
};

/**
 * Process GL entry for MPESA payments
 */
const processPaymentGLEntry = async (
  invoice,
  doubleEntryModel,
  appliedAmount,
  transactionId,
  facilityId,
  paymentMethod = "mpesa-transfer",
) => {
  try {
    console.log(
      `Starting GL entry for ${paymentMethod} payment on invoice:`,
      invoice.invoiceNumber,
    );

    let GLEntrySchema;
    if (payservedb.GLEntries && payservedb.GLEntries.schema) {
      GLEntrySchema = payservedb.GLEntries.schema;
    } else if (payservedb.GLEntry && payservedb.GLEntry.schema) {
      GLEntrySchema = payservedb.GLEntry.schema;
    } else {
      GLEntrySchema = new mongoose.Schema({
        entryDate: { type: Date, required: true, default: Date.now },
        accountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GLAccount",
          required: true,
        },
        creditAccountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GLAccount",
        },
        amount: { type: Number, required: true },
        description: { type: String, trim: true },
        facilityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Facility",
          required: true,
        },
        entryType: { type: String, enum: ["debit", "credit"], required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true },
      });
    }

    const GLEntryModel = await getModel("GLEntry", GLEntrySchema, facilityId);

    if (!GLEntryModel || !invoice.paymentDoubleEntryAccount) {
      console.log(
        "GL entry skipped - missing model or payment double entry account",
      );
      return null;
    }

    const paymentDoubleEntry = await doubleEntryModel.findById(
      invoice.paymentDoubleEntryAccount,
    );

    if (!paymentDoubleEntry) {
      console.log(
        `Payment double entry not found for ID: ${invoice.paymentDoubleEntryAccount}`,
      );
      return null;
    }

    const debitAccountId = paymentDoubleEntry.accountdebited;
    const creditAccountId = paymentDoubleEntry.accountcredited;

    if (!debitAccountId || !creditAccountId) {
      console.log("Missing debit or credit account IDs");
      return null;
    }

    const glEntries = await GLEntryModel.create([
      {
        entryDate: new Date(),
        accountId: debitAccountId,
        creditAccountId: creditAccountId,
        amount: appliedAmount,
        description: `${paymentMethod.toUpperCase()} payment (${transactionId}) for invoice ${invoice.invoiceNumber}`,
        facilityId,
        entryType: "debit",
      },
      {
        entryDate: new Date(),
        accountId: creditAccountId,
        creditAccountId: debitAccountId,
        amount: appliedAmount,
        description: `Credit entry for ${paymentMethod} payment (${transactionId}) for invoice ${invoice.invoiceNumber}`,
        facilityId,
        entryType: "credit",
      },
    ]);

    console.log(
      `Created GL entries: ${glEntries.map((e) => e._id).join(", ")}`,
    );

    return {
      facilityId: facilityId,
      accountdebited: debitAccountId,
      accountcredited: creditAccountId,
      amount: appliedAmount,
      transactionId,
      description: `${paymentMethod} payment for invoice ${invoice.invoiceNumber}`,
      entryIds: glEntries.map((e) => e._id),
      primaryEntryId: glEntries[0]._id,
      paymentMethod,
    };
  } catch (glErr) {
    console.error("Error saving GL entries:", glErr);
    return null;
  }
};

/**
 * Update account amounts with overpayment handling
 */
const updateAccountAmounts = async (
  accountNumber,
  paymentAllocations = [],
  overpayAmount = 0,
) => {
  try {
    console.log(`Updating account amounts for: ${accountNumber}`);
    const Account = payservedb.Account;
    const account = await Account.findOne({ accountNumber: accountNumber });

    if (account) {
      const totalRemainingBalance =
        paymentAllocations.reduce((sum, allocation) => {
          return sum + Math.max(0, allocation.newBalance);
        }, 0) - overpayAmount; // Subtract overpayment as it's a credit

      await Account.findOneAndUpdate(
        { accountNumber: accountNumber },
        { $set: { amount: Math.max(0, totalRemainingBalance) } }, // Ensure not negative
        { new: true },
      );

      console.log(
        `Updated account ${accountNumber} with total remaining balance: ${totalRemainingBalance}, overpay: ${overpayAmount}`,
      );
    } else {
      console.log(`No account found with accountNumber: ${accountNumber}`);
    }
  } catch (error) {
    console.error("Error updating account amounts:", error);
  }
};

/**
 * Main mobile payment handler
 */
const update_invoice_payment = async (request, reply) => {
  console.log("=== Start: update_invoice_payment ===");
  console.log(`Request params: ${JSON.stringify(request.params)}`);
  console.log(`Request body: ${JSON.stringify(request.body)}`);

  try {
    const { accountNumber } = request.params;
    // transactionCode is additive: only equity_bank_service (and any future
    // caller) that sends it benefits from the fallback below. Existing
    // callers that don't send it are completely unaffected.
    const { amount, transactionCode } = request.body;

    if (!accountNumber || !amount) {
      console.log("Error: Missing required parameters");
      return reply.code(400).send({
        success: false,
        error: "Account number and amount are required",
      });
    }

    const Account = payservedb.Account;
    const account = await Account.findOne({ accountNumber });

    if (!account) {
      console.log(`Error: Account not found for ${accountNumber}`);
      return reply.code(404).send({
        success: false,
        error: "Account not found",
      });
    }

    console.log(`Found account for facility: ${account.facilityId}`);

    // Fetch MPESA transactions
    let transactions = [];
    let mpesaReceiptNumber = null;

    try {
      console.log(`Fetching transactions for account: ${accountNumber}`);
      const response = await axios.get(
        `https://sandbox.payments.payserve.co.ke/v1/get_transaction_by_account_number/${accountNumber}`,
      );
      if (response.data && response.data.transactions) {
        transactions = response.data.transactions;
        const untaggedTransaction = transactions.find(
          (txn) => !txn.tagged && txn.amount === parseFloat(amount),
        );
        mpesaReceiptNumber = untaggedTransaction
          ? untaggedTransaction.mpesaReceiptNumber
          : null;
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }

    // ADDED: only reached when the lookup above found no matching untagged
    // mpesa transaction (mpesaReceiptNumber stays null) — previously that
    // always fell straight to the synthetic placeholder below, which is
    // what happens for every Equity bank-transfer payment since those
    // transactions never appear in mpesa-production's store. Now we prefer
    // the caller's own transactionCode (e.g. equity_bank_service's real
    // bank.reference) before giving up and generating a fake one. Nothing
    // above this line changed, so mpesa-production's existing behavior is
    // identical whenever the lookup succeeds.
    const transactionId =
      mpesaReceiptNumber ||
      transactionCode ||
      `MPESA-${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Determine invoice type
    const prefix = accountNumber.charAt(0);
    let invoiceModel,
      invoiceType,
      vasServiceModel = null;
    let isVasInvoice = false;
    let isWaterInvoice = false;

    switch (prefix) {
      case "5":
      case "6":
        invoiceModel = await getModel(
          "Invoice",
          payservedb.Invoice.schema,
          account.facilityId,
        );
        invoiceType = "invoice";
        break;
      case "7":
        invoiceModel = await getModel(
          "WaterInvoice",
          payservedb.WaterInvoice.schema,
          account.facilityId,
        );
        invoiceType = "waterinvoice";
        isWaterInvoice = true;
        break;
      case "8":
        invoiceModel = await getModel(
          "VasInvoice",
          payservedb.VasInvoice.schema,
          account.facilityId,
        );
        vasServiceModel = await getModel(
          "ValueAddedService",
          payservedb.ValueAddedService.schema,
          account.facilityId,
        );
        invoiceType = "vasinvoice";
        isVasInvoice = true;
        break;
      default:
        return reply.code(400).send({
          success: false,
          error: "Invalid account number prefix",
        });
    }

    // Find target invoice
    const targetInvoice = await invoiceModel.findOne({ accountNumber });
    if (!targetInvoice) {
      return reply.code(404).send({
        success: false,
        error: "Invoice not found",
      });
    }

    console.log(
      `Target invoice: ${targetInvoice.invoiceNumber}, account: ${accountNumber}`,
    );

    const totalPaymentAmount = parseFloat(amount);

    // 🔧 Get all unpaid invoices
    const contractId = targetInvoice.whatFor?.description || null;
    const clientId =
      targetInvoice.client?.clientId || targetInvoice.customerId || null;
    const invoiceTypeForQuery = isWaterInvoice
      ? "waterinvoice"
      : targetInvoice.whatFor?.invoiceType || invoiceType;

    const unpaidInvoices = await findUnpaidInvoicesForAccount(
      accountNumber,
      invoiceTypeForQuery,
      account.facilityId,
      invoiceModel,
      isWaterInvoice,
      clientId,
      contractId,
    );

    let allocations = [];
    let remainingPayment = totalPaymentAmount;
    let updatedInvoices = [];
    let glEntryRecordId = null;
    let isOverpaymentOnly = false;

    if (unpaidInvoices.length > 0) {
      // 🔧 Apply payment with BBF reduction
      const result = applyPaymentToInvoices(unpaidInvoices, totalPaymentAmount);
      allocations = result.allocations;
      remainingPayment = result.remainingPayment;

      // Update invoices in database
      for (const allocation of allocations) {
        const allocTransactionId = `${transactionId}-${allocation.invoiceId.toString().slice(-4)}`;

        // GL entry (only for first invoice)
        if (updatedInvoices.length === 0) {
          try {
            const doubleEntryModel = await getModel(
              "GLAccountDoubleEntries",
              payservedb.GLAccountDoubleEntries.schema,
              account.facilityId,
            );

            const invoice = unpaidInvoices.find(
              (inv) => inv._id.toString() === allocation.invoiceId.toString(),
            );

            if (
              invoice &&
              doubleEntryModel &&
              invoice.paymentDoubleEntryAccount
            ) {
              const glEntryData = await processPaymentGLEntry(
                invoice,
                doubleEntryModel,
                totalPaymentAmount,
                transactionId,
                account.facilityId,
                "mpesa-transfer",
              );
              if (glEntryData) {
                const glEntry = await doubleEntryModel.create(glEntryData);
                glEntryRecordId = glEntry._id;
              }
            }
          } catch (glError) {
            console.error("Error processing GL entry:", glError);
          }
        }

        // 🔧 FIX: Calculate payment completion correctly
        const paymentCompletionPercentage =
          allocation.previousBalance > 0
            ? (
                (allocation.newAmountPaid / allocation.previousBalance) *
                100
              ).toFixed(2)
            : "100.00";

        // Build reconciliation entry
        const reconciliationEntry = {
          date: new Date(),
          amount: allocation.amountAllocated,
          type: "mpesa-transfer",
          paymentReference: transactionId,
          notes: `MPESA payment allocation - ${allocation.newStatus}`,
          paymentCompletion: `${paymentCompletionPercentage}%`,
          remainingBalance: allocation.newBalance,
          paymentBreakdown: {
            towardsBBF: allocation.paidTowardsBBF,
            towardsCurrentCharges: allocation.paidTowardsCurrentCharges,
          },
        };

        if (allocation.bbfChanged) {
          reconciliationEntry.balanceBroughtForwardUpdate = {
            previousBBF: allocation.originalBBF,
            newBBF: allocation.newBBFValue,
            reduction: allocation.originalBBF - allocation.newBBFValue,
            reason: "Previous invoice(s) paid - BBF adjusted",
          };
        }

        // Update invoice
        const updateObj = {
          $set: {
            amountPaid: allocation.newAmountPaid,
            status: allocation.newStatus,
            paymentMethod: "mpesa-transfer",
            lastPaymentDate: new Date(),
            transactionReference: allocTransactionId,
          },
          $push: {
            reconciliationHistory: reconciliationEntry,
          },
        };

        // Update BBF if changed
        if (allocation.bbfChanged) {
          updateObj.$set.balanceBroughtForward = allocation.newBBFValue;
          console.log(
            `Updating ${allocation.invoiceNumber} BBF: ${allocation.originalBBF} → ${allocation.newBBFValue}`,
          );
        }

        if (!isWaterInvoice) {
          updateObj.$set["paymentDetails.paymentStatus"] =
            allocation.newBalance <= 0 ? "Completed" : "Partial";
          updateObj.$set["paymentDetails.paymentMethod"] = "mpesa-transfer";
          updateObj.$set["paymentDetails.paymentDate"] = new Date();
          updateObj.$set["paymentDetails.transactionId"] = allocTransactionId;
        }

        const updatedInvoice = await invoiceModel.findByIdAndUpdate(
          allocation.invoiceId,
          updateObj,
          { new: true },
        );

        if (updatedInvoice) {
          updatedInvoices.push(updatedInvoice);
          allocation.transactionId = allocTransactionId;
        }
      }

      // 🔧 FIX: Handle overpayment - record on the last invoice paid
      if (remainingPayment > 0 && updatedInvoices.length > 0) {
        const lastInvoice = updatedInvoices[updatedInvoices.length - 1];

        console.log(`\n=== Recording Overpayment ===`);
        console.log(`Overpayment amount: ${remainingPayment}`);
        console.log(`Recording on invoice: ${lastInvoice.invoiceNumber}`);

        await invoiceModel.findByIdAndUpdate(
          lastInvoice._id,
          {
            $set: { overpay: remainingPayment },
            $push: {
              reconciliationHistory: {
                date: new Date(),
                amount: remainingPayment,
                type: "overpayment",
                paymentReference: transactionId,
                notes: `Overpayment recorded - excess from ${totalPaymentAmount} payment`,
                remainingBalance: 0,
              },
            },
          },
          { new: true },
        );

        // Update the last invoice in our array
        const lastInvoiceIndex = updatedInvoices.length - 1;
        updatedInvoices[lastInvoiceIndex].overpay = remainingPayment;

        console.log(`✓ Overpayment recorded: ${remainingPayment}`);
      }
    } else {
      // 🔧 NEW: Handle case where there are no unpaid invoices
      console.log(`No unpaid invoices found for account ${accountNumber}`);

      // Find the most recent invoice to apply overpayment
      const mostRecentInvoice = await findMostRecentInvoiceForAccount(
        accountNumber,
        invoiceTypeForQuery,
        account.facilityId,
        invoiceModel,
        isWaterInvoice,
        clientId,
        contractId,
      );

      const overpaymentResult = await handleOverpaymentOnly(
        accountNumber,
        totalPaymentAmount,
        invoiceModel,
        mostRecentInvoice,
        transactionId,
        account.facilityId,
      );

      allocations = overpaymentResult.allocations;
      remainingPayment = overpaymentResult.remainingPayment;
      updatedInvoices = overpaymentResult.updatedInvoices;
      glEntryRecordId = overpaymentResult.glEntryRecordId;
      isOverpaymentOnly = overpaymentResult.isOverpaymentOnly;
    }

    // Update account balance with overpayment handling
    await updateAccountAmounts(accountNumber, allocations, remainingPayment);

    // Send SMS notifications
    try {
      for (const updatedInvoice of updatedInvoices) {
        const allocation = allocations.find(
          (alloc) =>
            alloc.invoiceId.toString() === updatedInvoice._id.toString(),
        );
        if (!allocation) continue;

        let clientPhone = null;
        const Customer = payservedb.Customer;

        // Try to get phone from customer
        if (updatedInvoice.client?.clientId || updatedInvoice.customerId) {
          try {
            const customer = await Customer.findById(
              updatedInvoice.client?.clientId || updatedInvoice.customerId,
            );
            if (customer && customer.phoneNumber) {
              clientPhone = customer.phoneNumber;
            }
          } catch (err) {
            console.log("Error fetching customer:", err.message);
          }
        }

        // Fallback to customerInfo
        if (!clientPhone) {
          clientPhone =
            updatedInvoice.customerInfo?.phone ||
            updatedInvoice.customerInfo?.phoneNumber;
        }

        if (clientPhone) {
          const phoneDigits = clientPhone.replace(/\D/g, "");
          const last9Digits = phoneDigits.slice(-9);

          if (last9Digits.length === 9) {
            const formattedAmount = allocation.amountAllocated.toFixed(2);
            const formattedBalance =
              allocation.newBalance > 0
                ? `Balance: ${allocation.newBalance.toFixed(2)}`
                : "Fully paid";
            const currencyCode = updatedInvoice.currency?.code || "KES";

            // Add overpayment info to SMS if applicable
            const overpayInfo =
              updatedInvoice.overpay && updatedInvoice.overpay > 0
                ? ` Credit: ${updatedInvoice.overpay.toFixed(2)}`
                : "";

            let messageBody;
            if (isOverpaymentOnly) {
              messageBody = `Thank you for your MPESA payment of ${currencyCode} ${totalPaymentAmount.toFixed(2)}. No unpaid invoices found. Credit of ${totalPaymentAmount.toFixed(2)} recorded for future invoices. Receipt: ${transactionId}`;
            } else {
              messageBody =
                allocations.length > 1
                  ? `Thank you for your MPESA payment of ${currencyCode} ${formattedAmount} for Invoice #${updatedInvoice.invoiceNumber}. ${formattedBalance}${overpayInfo}. Receipt: ${allocation.transactionId}`
                  : `Thank you for your MPESA payment of ${currencyCode} ${formattedAmount} for Invoice #${updatedInvoice.invoiceNumber}. ${formattedBalance}${overpayInfo}. Receipt: ${allocation.transactionId}`;
            }

            await sendSMS(account.facilityId, last9Digits, messageBody);
          }
        }

        // Property manager notifications for lease invoices
        if (updatedInvoice?.whatFor?.invoiceType === "Lease") {
          try {
            const facilityObjectId =
              updatedInvoice.facility?.id ||
              updatedInvoice.facility?._id ||
              updatedInvoice.facilityId;

            if (facilityObjectId) {
              const Company = mongoose.model(
                "Company",
                payservedb.Company.schema,
              );
              const company = await Company.findOne({
                facilities: facilityObjectId,
                isEnabled: true,
              }).lean();

              if (company) {
                const User = mongoose.model("User", payservedb.User.schema);
                const propertyManagers = await User.find({
                  type: "Company",
                  companies: company._id,
                  isEnabled: true,
                })
                  .select("phoneNumber phone")
                  .lean();

                const formattedAmount = allocation.amountAllocated.toFixed(2);
                const formattedBalance =
                  allocation.newBalance > 0
                    ? `Balance: ${allocation.newBalance.toFixed(2)}`
                    : "Fully paid";
                const currencyCode = updatedInvoice.currency?.code || "KES";

                for (const manager of propertyManagers) {
                  const managerPhone = manager.phoneNumber || manager.phone;
                  if (!managerPhone) continue;

                  const phoneDigits = managerPhone.replace(/\D/g, "");
                  const last9Digits = phoneDigits.slice(-9);

                  if (last9Digits.length === 9) {
                    let smsMessage;
                    if (isOverpaymentOnly) {
                      smsMessage = `MPESA overpayment received for account ${accountNumber}. Amount: ${currencyCode} ${totalPaymentAmount.toFixed(2)}. Credit available for future invoices. Receipt: ${transactionId}`;
                    } else {
                      smsMessage = `MPESA payment received for unit ${updatedInvoice.unit?.name} Lease Invoice #${updatedInvoice.invoiceNumber}. Amount: ${currencyCode} ${formattedAmount}. ${formattedBalance}. Receipt: ${allocation.transactionId}`;
                    }
                    await sendSMS(account.facilityId, last9Digits, smsMessage);
                  }
                }
              }
            }
          } catch (error) {
            console.error(
              "Error sending property manager notifications:",
              error,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error sending confirmation messages:", error);
    }

    console.log(`\n=== Payment Summary ===`);
    console.log(`Total Payment: ${totalPaymentAmount}`);
    console.log(`Allocated: ${totalPaymentAmount - remainingPayment}`);
    console.log(`Across ${allocations.length} invoices`);
    console.log(`Remaining/Overpay: ${remainingPayment}`);
    console.log(`Is Overpayment Only: ${isOverpaymentOnly}`);

    // Record payment to Zoho Books if facility has Zoho integration
    // Send FULL payment amount to Zoho for the PRIMARY (first) invoice only
    if (!isOverpaymentOnly && allocations.length > 0) {
      try {
        const facilityId = account.facilityId.toString();
        const primaryInvoice = allocations[0];
        console.log(`\n=== Recording payment to Zoho Books ===`);
        console.log(`Facility ID: ${facilityId}`);
        console.log(`Primary Invoice: ${primaryInvoice.invoiceNumber}`);
        console.log(`Full Payment Amount: ${amount} (M-Pesa payment)`);

        // Send FULL payment amount to Zoho for the primary invoice
        // (Even if internally allocated across multiple invoices)
        try {
          console.log(
            `\n🔍 [ZOHO-PAYMENT] Recording FULL M-Pesa payment for primary invoice:`,
          );
          console.log(`   Invoice Number: ${primaryInvoice.invoiceNumber}`);
          console.log(`   Amount: ${amount} (FULL payment amount)`);
          console.log(`   Payment Mode: mpesa`);

          await axios.post(
            `${process.env.BACKEND_URL}/api/integrations/zoho/payments/record-by-number`,
            {
              facilityId: facilityId,
              invoiceNumber: primaryInvoice.invoiceNumber,
              amount: amount,
              paymentMode: "mpesa",
              referenceNumber: transactionId || mpesaReceiptNumber,
              paymentDate: new Date().toISOString().split("T")[0],
              description: `M-Pesa payment - Receipt: ${mpesaReceiptNumber || transactionId}`,
            },
          );
          console.log(
            `✅ Full payment (${amount}) recorded to Zoho for invoice ${primaryInvoice.invoiceNumber}`,
          );
        } catch (zohoError) {
          console.error(
            `⚠️ Failed to record payment to Zoho for invoice ${primaryInvoice.invoiceNumber} (non-fatal):`,
            zohoError.message,
          );
        }

        console.log(`=== Zoho payment recording completed ===`);
      } catch (zohoError) {
        console.error(
          "⚠️ Failed to record payment to Zoho Books (non-fatal):",
          zohoError.message,
        );
        // Don't fail the payment if Zoho sync fails - payment was successful locally
      }
    }

    return reply.code(200).send({
      success: true,
      message: isOverpaymentOnly
        ? `Payment recorded as overpayment - no unpaid invoices found. Credit of ${totalPaymentAmount} available for future invoices.`
        : allocations.length > 1
          ? `Payment of ${totalPaymentAmount} allocated chronologically across ${allocations.length} invoices`
          : remainingPayment > 0
            ? `Payment processed successfully with ${remainingPayment} overpayment recorded`
            : "Payment processed successfully",
      data: {
        accountNumber,
        paymentAmount: amount,
        allocations: allocations.map((alloc) => ({
          invoiceNumber: alloc.invoiceNumber,
          yearMonth: alloc.yearMonth,
          amountAllocated: alloc.amountAllocated,
          paidTowardsBBF: alloc.paidTowardsBBF,
          paidTowardsCurrentCharges: alloc.paidTowardsCurrentCharges,
          previousBalance: alloc.previousBalance,
          newBalance: alloc.newBalance,
          status: alloc.newStatus,
          bbfAdjusted: alloc.bbfChanged,
          originalBBF: alloc.originalBBF,
          newBBF: alloc.newBBFValue,
          isOverpaymentOnly: alloc.isOverpaymentOnly || false,
        })),
        totalAllocated: totalPaymentAmount - remainingPayment,
        overpayAmount: remainingPayment,
        affectedInvoices: updatedInvoices.length,
        isChronologicalPayment: allocations.length > 1,
        glEntryProcessed: !!glEntryRecordId,
        isOverpaymentOnly: isOverpaymentOnly,
        receipt: {
          mpesaReceiptNumber: mpesaReceiptNumber || transactionId,
          transactionId,
          amount: totalPaymentAmount,
          paymentDate: new Date(),
          accountNumber,
          invoiceNumbers: allocations.map((alloc) => alloc.invoiceNumber),
          overpaymentRecorded: remainingPayment > 0,
          isOverpaymentOnly: isOverpaymentOnly,
        },
      },
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    console.error("Error stack:", error.stack);
    return reply.code(500).send({
      success: false,
      error: error.message || "Error processing payment",
    });
  } finally {
    console.log("=== End: update_invoice_payment ===");
  }
};

module.exports = update_invoice_payment;
