const mongoose = require("mongoose");
const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");
const utilityDb = require("../../../../middlewares/utilityDb");
const axios = require("axios");
const {
  applyOverpaymentToAccount,
} = require("../apply_overpayment_to_account");

/**
 * Sends a message to the messaging queue
 */
const sendMessageToQueue = async (
  user,
  recipient,
  subject,
  messageBody,
  type,
) => {
  try {
    const baseUrl = process.env.messagingServiceUrl;

    // Validate messaging service URL before attempting to send
    if (!baseUrl) {
      console.warn(
        "⚠️  messagingServiceUrl environment variable not configured - skipping message queue",
      );
      return {
        success: false,
        skipped: true,
        reason: "messagingServiceUrl not configured",
      };
    }

    const messagePayload = {
      user,
      recipient,
      subject,
      type,
      message: messageBody,
    };

    const response = await axios.post(`${baseUrl}`, messagePayload);
    console.log("Message sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error(`Error sending message to queue: ${error.message}`);
    // Don't throw - make this non-fatal so payment approval continues
    return { success: false, error: error.message };
  }
};

/**
 * Function to map payment method from UI-friendly format to schema-compatible format
 */
const mapPaymentMethod = (methodFromUI) => {
  if (!methodFromUI) return "cash";
  const method = methodFromUI.toLowerCase();
  switch (method) {
    case "cash":
      return "cash";
    case "bank transfer":
    case "bank-transfer":
      return "bank-transfer";
    case "cheque":
    case "check":
      return "cheque";
    default:
      console.log(
        `Unknown payment method format: ${methodFromUI}, defaulting to 'cash'`,
      );
      return "cash";
  }
};

/**
 * NEW: Update account amounts using contract ID
 */
const updateAccountAmountsByContract = async (contractId, facilityId, invoiceModel, paymentAllocations = [], overpayAmount = 0) => {
    try {
        console.log(`[CONTRACT-PAYMENT] Updating account amounts for contract: ${contractId}`);

        // Find all invoices for this contract to get account number
        const allInvoices = await invoiceModel.find({
            'whatFor.description': contractId
        }).lean();

    if (allInvoices.length === 0) {
      console.log(
        `[CONTRACT-PAYMENT] No invoices found for contract ${contractId}`,
      );
      return;
    }

        // Get the account number from the first invoice
        const accountNumber = allInvoices[0].accountNumber;

        if (!accountNumber) {
            console.log(`[CONTRACT-PAYMENT] No account number found for contract ${contractId}`);
            return;
        }

    const Account = payservedb.Account;
    const account = await Account.findOne({ accountNumber: accountNumber });

    if (account) {
      const totalRemainingBalance =
        paymentAllocations.reduce((sum, allocation) => {
          return sum + Math.max(0, allocation.newBalance);
        }, 0) - overpayAmount;

      await Account.findOneAndUpdate(
        { accountNumber: accountNumber },
        { $set: { amount: Math.max(0, totalRemainingBalance) } },
        { new: true },
      );

      console.log(
        `[CONTRACT-PAYMENT] Updated account ${accountNumber} for contract ${contractId}: balance=${totalRemainingBalance}, overpay=${overpayAmount}`,
      );
    } else {
      console.log(
        `[CONTRACT-PAYMENT] No account found with accountNumber: ${accountNumber}`,
      );
    }
  } catch (error) {
    console.error("[CONTRACT-PAYMENT] Error updating account amounts:", error);
  }
};

/**
 * Send booking payment confirmation (SMS + Email with PDF)
 */
const sendBookingPaymentConfirmation = async (
  invoice,
  allocation,
  methodToUse,
  receiptNumber,
  facility,
  overpayAmount = 0,
) => {
  try {
    const { sendSms } = require("../../../utils/send_new_sms");
    const {
      generateBookingInvoicePDF,
    } = require("../../external/booking/generateBookingInvoicePDF");
    const {
      sendBookingEmail,
    } = require("../../external/booking/sendBookingEmail");

    if (
      !invoice.guestInfo ||
      !invoice.guestInfo.email ||
      !invoice.guestInfo.phone
    ) {
      console.log(
        "[BOOKING-PAYMENT] Missing guest contact info, skipping notifications",
      );
      return;
    }

    // Get booking reservation and property details
    const BookingReservation = await getModel(
      "BookingReservation",
      payservedb.BookingReservation.schema,
      facility._id,
    );
    const BookingProperty = await getModel(
      "BookingProperty",
      payservedb.BookingProperty.schema,
      facility._id,
    );
    const Unit = await getModel("Unit", payservedb.Unit.schema, facility._id);
    const Currency = await getModel(
      "Currency",
      payservedb.Currency.schema,
      facility._id,
    );

    const reservation = await BookingReservation.findOne({
      _id: invoice.bookingReservationId,
    });
    const property = reservation
      ? await BookingProperty.findById(reservation.bookingPropertyId)
      : null;
    const unit = reservation ? await Unit.findById(reservation.unitId) : null;
    const currency = await Currency.findById(invoice.currencyId);

    const paymentMethodDisplay =
      {
        cash: "Cash",
        "bank-transfer": "Bank Transfer",
        cheque: "Cheque",
      }[methodToUse] || methodToUse;

    const isFullyPaid = allocation.newStatus === "Paid";

    // Send SMS
    try {
      let formattedPhone = invoice.guestInfo.phone
        .replace(/\s+/g, "")
        .replace(/-/g, "")
        .replace(/\(/g, "")
        .replace(/\)/g, "");
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + formattedPhone;
      }

      const smsMessage = isFullyPaid
        ? `Payment confirmed! Your booking at ${property?.propertyName || "property"} is now CONFIRMED (${reservation?.bookingReservationId || "N/A"}). Amount paid: ${currency?.code || "KES"} ${allocation.amountAllocated.toFixed(2)}. Receipt: ${receiptNumber}`
        : `Partial payment received for your booking at ${property?.propertyName || "property"} (${reservation?.bookingReservationId || "N/A"}). Amount: ${currency?.code || "KES"} ${allocation.amountAllocated.toFixed(2)}. Balance: ${allocation.newBalance.toFixed(2)}. Receipt: ${receiptNumber}`;

      await sendSms(facility._id, formattedPhone, smsMessage);
      console.log(`[BOOKING-PAYMENT] SMS sent to ${formattedPhone}`);
    } catch (smsError) {
      console.error("[BOOKING-PAYMENT] Failed to send SMS:", smsError);
    }

    // Send Email with PDF
    try {
      // Generate updated PDF invoice
      const pdfBuffer = await generateBookingInvoicePDF(
        invoice,
        reservation,
        property,
        unit,
        currency,
      );

      const emailSubject = isFullyPaid
        ? `Booking Confirmed - Payment Successful - ${reservation?.bookingReservationId || "N/A"}`
        : `Partial Payment Received - ${reservation?.bookingReservationId || "N/A"}`;

      const emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${isFullyPaid ? "#28a745" : "#ffc107"};">${isFullyPaid ? "Booking Confirmed!" : "Partial Payment Received"}</h2>

                    <p>Dear ${invoice.guestInfo.name},</p>

                    <p>${
                      isFullyPaid
                        ? `Great news! We have received your full payment and your booking is now confirmed.`
                        : `We have received your partial payment. Please complete the remaining balance to confirm your booking.`
                    }</p>

                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #555;">Payment Details</h3>
                        <p><strong>Booking Reference:</strong> ${reservation?.bookingReservationId || "N/A"}</p>
                        <p><strong>Invoice Number:</strong> ${invoice.invoiceId || invoice.invoiceNumber}</p>
                        <p><strong>Property:</strong> ${property?.propertyName || "N/A"}</p>
                        <p><strong>Unit:</strong> ${unit?.name || "N/A"}</p>
                        <p><strong>Check-in:</strong> ${reservation?.checkIn ? new Date(reservation.checkIn).toLocaleDateString() : "N/A"}</p>
                        <p><strong>Check-out:</strong> ${reservation?.checkOut ? new Date(reservation.checkOut).toLocaleDateString() : "N/A"}</p>
                        <p><strong>Amount Paid:</strong> ${currency?.code || "KES"} ${allocation.amountAllocated.toFixed(2)}</p>
                        ${!isFullyPaid ? `<p><strong>Remaining Balance:</strong> <span style="color: #ff6600;">${currency?.code || "KES"} ${allocation.newBalance.toFixed(2)}</span></p>` : ""}
                        <p><strong>Payment Method:</strong> ${paymentMethodDisplay}</p>
                        <p><strong>Receipt Number:</strong> ${receiptNumber}</p>
                        <p><strong>Payment Status:</strong> <span style="color: ${isFullyPaid ? "#28a745" : "#ffc107"}; font-weight: bold;">${allocation.newStatus}</span></p>
                    </div>

                    ${
                      isFullyPaid
                        ? `
                    <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>✅ Your booking is confirmed!</strong> We look forward to welcoming you.</p>
                    </div>
                    `
                        : `
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>⚠️ Action Required:</strong> Please complete the remaining balance to confirm your booking.</p>
                    </div>
                    `
                    }

                    <p>Your updated invoice is attached to this email.</p>

                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                    <p style="font-size: 12px; color: #999;">This is an automated message. If you have any questions, please contact us.</p>
                </div>
            `;

      await sendBookingEmail(
        facility._id,
        invoice.guestInfo.email,
        emailSubject,
        emailBody,
        [
          {
            filename: `Invoice-${invoice.invoiceId || invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      );

      console.log(`[BOOKING-PAYMENT] Email sent to ${invoice.guestInfo.email}`);
    } catch (emailError) {
      console.error("[BOOKING-PAYMENT] Failed to send email:", emailError);
    }
  } catch (error) {
    console.error(
      "[BOOKING-PAYMENT] Error sending booking payment confirmation:",
      error,
    );
  }
};

/**
 * Send payment confirmation messages for allocations
 */
const sendPaymentConfirmationMessages = async (updatedInvoices, paymentAllocations, totalPayment, methodToUse, facility, receiptNumber, overpayAmount = 0) => {
    try {
        const customerAllocations = new Map();

        for (let i = 0; i < updatedInvoices.length; i++) {
            const invoice = updatedInvoices[i];
            const allocation = paymentAllocations[i];

            const customerId = invoice.client?.clientId || invoice.customerId;
            if (!customerId) continue;

      const customerKey = customerId.toString();
      if (!customerAllocations.has(customerKey)) {
        customerAllocations.set(customerKey, {
          customer: invoice.client || { clientId: customerId },
          invoices: [],
          totalAllocated: 0,
          invoice: invoice,
        });
      }

      const customerData = customerAllocations.get(customerKey);
      customerData.invoices.push({
        invoiceNumber: invoice.invoiceNumber,
        allocated: allocation.amountAllocated,
        status: allocation.newStatus,
        overpay: invoice.overpay || 0,
      });
      customerData.totalAllocated += allocation.amountAllocated;
    }

        for (const [customerId, data] of customerAllocations) {
            await sendCustomerPaymentConfirmation(
                customerId,
                data,
                methodToUse,
                receiptNumber,
                facility,
                overpayAmount
            );
        }

    } catch (error) {
        console.error('Error sending confirmation messages:', error);
    }
};

/**
 * Send payment confirmation to a specific customer
 */
const sendCustomerPaymentConfirmation = async (
  customerId,
  allocationData,
  methodToUse,
  receiptNumber,
  facility,
  overpayAmount = 0,
) => {
  try {
    const Customer = payservedb.Customer;
    let customer = null;
    let clientPhone = null;

    try {
      customer = await Customer.findById(customerId);
      if (customer && customer.phoneNumber) {
        clientPhone = customer.phoneNumber;
      }
    } catch (error) {
      console.log("Error fetching customer from main database:", error.message);
    }

        if (!clientPhone && allocationData.invoice) {
            const invoice = allocationData.invoice;

            if (invoice.customerInfo?.phone) {
                clientPhone = invoice.customerInfo.phone;
            } else if (invoice.customerInfo?.phoneNumber) {
                clientPhone = invoice.customerInfo.phoneNumber;
            }

      if (!clientPhone && invoice.accountNumber) {
        try {
          const accountCustomer = await Customer.findOne({
            $or: [
              { customerNumber: invoice.accountNumber },
              { accountNumber: invoice.accountNumber },
            ],
          });
          if (accountCustomer && accountCustomer.phoneNumber) {
            clientPhone = accountCustomer.phoneNumber;
          }
        } catch (error) {
          console.log("Error in account-based customer lookup:", error.message);
        }
      }
    }

    if (!clientPhone) {
      console.log(`No phone number found for customer ${customerId}`);
      return;
    }

    const phoneDigits = clientPhone.replace(/\D/g, "");
    const last9Digits = phoneDigits.slice(-9);

    if (last9Digits.length !== 9) {
      console.log(`Invalid phone number format: ${clientPhone}`);
      return;
    }

        const paymentMethodDisplay = {
            'cash': 'Cash',
            'bank-transfer': 'Bank Transfer',
            'cheque': 'Cheque'
        }[methodToUse] || methodToUse;

        let messageBody;
        if (allocationData.invoices.length === 1) {
            const invoice = allocationData.invoices[0];
            const overpayInfo = (invoice.overpay && invoice.overpay > 0)
                ? ` Credit: ${invoice.overpay.toFixed(2)}`
                : '';
            messageBody = `Thank you for your ${paymentMethodDisplay} payment of KES ${allocationData.totalAllocated.toFixed(2)} for Invoice #${invoice.invoiceNumber}. Status: ${invoice.status}.${overpayInfo} Receipt: ${receiptNumber}`;
        } else {
            const paidInvoices = allocationData.invoices.filter(inv => inv.status === 'Paid').length;
            const overpayInfo = overpayAmount > 0 ? ` Credit: ${overpayAmount.toFixed(2)}` : '';
            messageBody = `Thank you for your ${paymentMethodDisplay} payment of KES ${allocationData.totalAllocated.toFixed(2)} allocated across ${allocationData.invoices.length} invoices. ${paidInvoices} fully paid.${overpayInfo} Receipt: ${receiptNumber}`;
        }

    await sendMessageToQueue(
      "Payserve",
      last9Digits,
      "",
      messageBody,
      "SMS Meliora",
    );

    console.log(
      `Payment confirmation sent to customer ${customerId}: ${last9Digits}`,
    );
  } catch (error) {
    console.error(
      `Error sending confirmation to customer ${customerId}:`,
      error,
    );
  }
};

/**
 * Process GL payment entry for cash payments
 */
const processPaymentGLEntry = async (invoice, doubleEntryModel, appliedAmount, paymentMethod, transactionId, facilityId, user) => {
    try {
        console.log('Starting GL entry processing for invoice:', invoice.invoiceNumber);

        let GLEntrySchema;
        if (payservedb.GLEntries && payservedb.GLEntries.schema) {
            GLEntrySchema = payservedb.GLEntries.schema;
        } else if (payservedb.GLEntry && payservedb.GLEntry.schema) {
            GLEntrySchema = payservedb.GLEntry.schema;
        } else {
            GLEntrySchema = new mongoose.Schema({
                entryDate: { type: Date, required: true, default: Date.now },
                accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'GLAccount', required: true },
                creditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'GLAccount' },
                amount: { type: Number, required: true },
                description: { type: String, trim: true },
                facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
                entryType: { type: String, enum: ['debit', 'credit'], required: true },
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now },
                isActive: { type: Boolean, default: true }
            });
        }

    const GLEntryModel = await getModel("GLEntry", GLEntrySchema, facilityId);

    if (!GLEntryModel) {
      console.log("Failed to get GLEntry model");
      return null;
    }

    if (!invoice.paymentDoubleEntryAccount) {
      console.log("Invoice does not have a paymentDoubleEntryAccount property");
      return null;
    }

    const paymentDoubleEntry = await doubleEntryModel.findById(
      invoice.paymentDoubleEntryAccount,
    );

    if (!paymentDoubleEntry) {
      console.log(
        `Error: paymentDoubleEntryAccount not found for ID: ${invoice.paymentDoubleEntryAccount}`,
      );
      return null;
    }

    const debitAccountId = paymentDoubleEntry.accountdebited;
    const creditAccountId = paymentDoubleEntry.accountcredited;

    if (!debitAccountId || !creditAccountId) {
      console.log("Error: Missing debit or credit account IDs in double entry");
      return null;
    }

    console.log(
      `Creating GL entries with debit account: ${debitAccountId}, credit account: ${creditAccountId}`,
    );

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
        description: `Credit entry for payment (${transactionId}) for invoice ${invoice.invoiceNumber}`,
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
      description: `Payment for invoice ${invoice.invoiceNumber}`,
      entryIds: glEntries.map((e) => e._id),
      primaryEntryId: glEntries[0]._id,
    };
  } catch (glErr) {
    console.error("Error saving GL entries:", glErr);
    return null;
  }
};

/**
 * NEW: Find unpaid invoices by CONTRACT ID instead of account number
 */
const findUnpaidInvoicesByContract = async (
  contractId,
  invoiceType,
  facilityId,
  invoiceModel,
  isWaterInvoice = false,
) => {
  try {
    let query = {
      status: { $in: ["Unpaid", "Partially Paid", "Overdue", "Pending"] },
    };

        if (isWaterInvoice) {
            // Water invoices don't have contract IDs - use facilityId
            query.facilityId = facilityId;
        } else {
            // For Lease, Levy, PM, VAS - use whatFor.description (contract ID)
            query['whatFor.description'] = contractId;

            // Optional: Also filter by invoice type for safety
            if (invoiceType) {
                query['whatFor.invoiceType'] = invoiceType;
            }
        }

    const unpaidInvoices = await invoiceModel
      .find(query)
      .sort({ yearMonth: 1, issueDate: 1, createdAt: 1 })
      .lean();

        console.log(`[CONTRACT-PAYMENT] Found ${unpaidInvoices.length} unpaid invoices for contract: ${contractId}`);

        unpaidInvoices.forEach(inv => {
            console.log(`  - ${inv.invoiceNumber} | ${inv.yearMonth} | Status: ${inv.status} | Balance: ${inv.totalAmount - (inv.amountPaid || 0)}`);
        });

    return unpaidInvoices;
  } catch (error) {
    console.error("[CONTRACT-PAYMENT] Error finding unpaid invoices:", error);
    return [];
  }
};

/**
 * NEW: Find the most recent invoice by CONTRACT ID (for overpayment handling)
 */
const findMostRecentInvoiceByContract = async (
  contractId,
  invoiceType,
  facilityId,
  invoiceModel,
  isWaterInvoice = false,
) => {
  try {
    let query = {};

    if (isWaterInvoice) {
      query.facilityId = facilityId;
    } else {
      query["whatFor.description"] = contractId;
      if (invoiceType) {
        query["whatFor.invoiceType"] = invoiceType;
      }
    }

    const recentInvoice = await invoiceModel
      .findOne(query)
      .sort({ yearMonth: -1, issueDate: -1, createdAt: -1 })
      .lean();

    if (recentInvoice) {
      console.log(
        `[CONTRACT-PAYMENT] Most recent invoice for overpayment: ${recentInvoice.invoiceNumber} (${recentInvoice.yearMonth})`,
      );
    } else {
      console.log(
        `[CONTRACT-PAYMENT] No invoices found for contract ${contractId} to apply overpayment`,
      );
    }

    return recentInvoice;
  } catch (error) {
    console.error(
      "[CONTRACT-PAYMENT] Error finding most recent invoice:",
      error,
    );
    return null;
  }
};

/**
 * 🔧 COMPLETE FIX: BBF reduction that properly cascades through ALL future invoices
 * The key insight: BBF reductions must continue flowing through ALL subsequent invoices
 */
const applyPaymentToInvoices = (unpaidInvoices, totalPayment) => {
    let remainingPayment = totalPayment;
    const allocations = [];

    console.log(`\n=== Step 1: Calculate BBF reductions (with cascading) ===`);

    // Create working copy with adjusted BBF
    const adjustedInvoices = unpaidInvoices.map((inv) => ({ ...inv }));

    // Track BBF reductions that need to cascade to ALL future invoices
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

        const currentCharges = getInvoiceCurrentCharges(invoice);
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
        const originalBBF =
            unpaidInvoices.find(
                (inv) => inv._id.toString() === invoice._id.toString(),
            ).balanceBroughtForward || 0;

        const adjustedBBF = invoice.balanceBroughtForward || 0;
        const currentCharges = getInvoiceCurrentCharges(invoice);
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
                    newStatus: invoice.status,
                    originalBBF: originalBBF,
                    newBBFValue: adjustedBBF,
                    bbfChanged: true,
                    isBBFAdjustmentOnly: true,
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
 * 🔧 NEW: Helper function to extract current charges from different invoice types
 */
const getInvoiceCurrentCharges = (invoice) => {
    // Water invoices
    if (invoice.invoiceNumber && invoice.invoiceNumber.startsWith('WTR-')) {
        return invoice.charges?.totalMonthlyBill || invoice.totalAmount || invoice.amount || 0;
    }

    // Lease/Levy invoices
    if (invoice.totalAmount !== undefined) {
        return invoice.totalAmount;
    }

    // Fallback for any invoice type
    return invoice.totalAmount || invoice.amount ||
        invoice.charges?.totalMonthlyBill ||
        (invoice.items && invoice.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)) || 0;
};

/**
 * 🔧 SIMPLE PAYMENT ALLOCATION FOR WATER INVOICES
 */
const applyWaterInvoicePayment = async (waterInvoice, totalPayment, methodToUse, payment, invoiceModel, facilityId, user) => {
    console.log(`[WATER-PAYMENT] Applying simple payment to water invoice`);

    const transactionId = `${methodToUse.toUpperCase()}-${Date.now().toString(36)}-${waterInvoice._id.toString().slice(-4)}`;

    // Calculate water invoice balance
    const currentCharges = waterInvoice.charges?.totalMonthlyBill || 0;
    const bbf = waterInvoice.balanceBroughtForward || 0;
    const previouslyPaid = waterInvoice.amountPaid || 0;
    const invoiceBalance = currentCharges + bbf - previouslyPaid;

    console.log(`[WATER-PAYMENT] Invoice balance: ${invoiceBalance}, Payment: ${totalPayment}`);

    // Apply payment (full or partial)
    const paymentToApply = Math.min(totalPayment, invoiceBalance);
    const newAmountPaid = previouslyPaid + paymentToApply;
    const newBalance = invoiceBalance - paymentToApply;
    const remainingPayment = totalPayment - paymentToApply;

    // Determine status
    let newStatus;
    if (newBalance <= 0) {
        newStatus = 'Paid';
    } else if (newAmountPaid > 0) {
        newStatus = 'Partially Paid';
    } else {
        newStatus = waterInvoice.status;
    }

    // Create allocation
    const allocations = [{
        invoiceId: waterInvoice._id,
        invoiceNumber: waterInvoice.invoiceNumber,
        yearMonth: waterInvoice.yearMonth,
        amountAllocated: paymentToApply,
        paidTowardsBBF: 0, // Water invoices don't use BBF allocation
        paidTowardsCurrentCharges: paymentToApply,
        previousBalance: invoiceBalance,
        newBalance: newBalance,
        newAmountPaid: newAmountPaid,
        newStatus: newStatus,
        originalBBF: bbf,
        newBBFValue: bbf,
        bbfChanged: false,
        transactionId: transactionId
    }];

    console.log(`[WATER-PAYMENT] Applied ${paymentToApply} to invoice, remaining: ${remainingPayment}, new status: ${newStatus}`);

    let glEntryRecordId = null;

    // GL entry for water invoice
    try {
        const doubleEntryModel = await getModel(
            'GLAccountDoubleEntries',
            payservedb.GLAccountDoubleEntries.schema,
            facilityId
        );

    if (
      waterInvoice &&
      doubleEntryModel &&
      waterInvoice.paymentDoubleEntryAccount
    ) {
      const glEntryData = await processPaymentGLEntry(
        waterInvoice,
        doubleEntryModel,
        paymentToApply,
        methodToUse,
        transactionId,
        facilityId,
        user,
      );
      if (glEntryData) {
        const glEntry = await doubleEntryModel.create(glEntryData);
        glEntryRecordId = glEntry._id;
      }
    }
  } catch (glError) {
    console.error("[WATER-PAYMENT] Error processing GL entry:", glError);
  }

    // Calculate payment completion
    const paymentCompletionPercentage = invoiceBalance > 0
        ? ((paymentToApply / invoiceBalance) * 100).toFixed(2)
        : '100.00';

  // Build reconciliation entry
  const reconciliationEntry = {
    date: new Date(),
    amount: paymentToApply,
    type: methodToUse,
    paymentReference:
      payment.paymentReference || payment.receiptNumber || transactionId,
    notes: `Water invoice payment - ${newStatus}`,
    paymentCompletion: `${paymentCompletionPercentage}%`,
    remainingBalance: newBalance,
    allocationSource: payment._id,
    glEntryId: glEntryRecordId,
    paymentBreakdown: {
      towardsBBF: 0,
      towardsCurrentCharges: paymentToApply,
    },
  };

  // Update water invoice
  const updateObj = {
    $set: {
      amountPaid: newAmountPaid,
      status: newStatus,
      paymentMethod: methodToUse,
      lastPaymentDate: new Date(),
      transactionReference: transactionId,
    },
    $push: {
      reconciliationHistory: reconciliationEntry,
    },
  };

  // Handle overpayment for water invoice
  if (remainingPayment > 0) {
    updateObj.$set.overpay = remainingPayment;
    console.log(`[WATER-PAYMENT] Recording overpayment: ${remainingPayment}`);
  }

  const updatedInvoice = await invoiceModel.findByIdAndUpdate(
    waterInvoice._id,
    updateObj,
    { new: true },
  );

  const updatedInvoices = updatedInvoice ? [updatedInvoice] : [];

  console.log(
    `[WATER-PAYMENT] Successfully updated water invoice: ${waterInvoice.invoiceNumber}`,
  );

    return {
        allocations,
        remainingPayment,
        updatedInvoices,
        glEntryRecordId
    };
};

/**
 * Handle overpayment when no unpaid invoices exist
 */
const handleOverpaymentOnly = async (accountNumber, totalPayment, invoiceModel, mostRecentInvoice, methodToUse, payment, facilityId, user) => {
    console.log(`\n=== Handling Overpayment Only ===`);
    console.log(`No unpaid invoices found. Applying ${totalPayment} as overpayment to most recent invoice`);

    const transactionId = `${methodToUse.toUpperCase()}-OVERPAY-${Date.now().toString(36)}`;
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
          methodToUse,
          transactionId,
          facilityId,
          user,
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
        paymentMethod: methodToUse,
        lastPaymentDate: new Date(),
        transactionReference: transactionId,
      },
      $push: {
        reconciliationHistory: {
          date: new Date(),
          amount: totalPayment,
          type: "overpayment",
          paymentReference:
            payment.paymentReference || payment.receiptNumber || transactionId,
          notes: `Full payment recorded as overpayment - no unpaid invoices`,
          paymentCompletion: "100%",
          remainingBalance: 0,
          allocationSource: payment._id,
          glEntryId: glEntryRecordId,
        },
      },
    };

    if (!mostRecentInvoice.invoiceNumber.startsWith("WTR-")) {
      updateObj.$set["paymentDetails.paymentStatus"] = "Completed";
      updateObj.$set["paymentDetails.paymentMethod"] = methodToUse;
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
                newStatus: mostRecentInvoice.status || 'Paid',
                originalBBF: mostRecentInvoice.balanceBroughtForward || 0,
                newBBFValue: mostRecentInvoice.balanceBroughtForward || 0,
                bbfChanged: false,
                transactionId: transactionId,
                isOverpaymentOnly: true
            });
        }

        console.log(`✓ Overpayment of ${totalPayment} recorded on invoice: ${mostRecentInvoice.invoiceNumber}`);
    } else {
        console.log(`⚠️ No recent invoice found to record overpayment. Payment will be recorded as overpayment only.`);

        // Create a minimal allocation for response
        allocations.push({
            invoiceId: null,
            invoiceNumber: 'OVERPAYMENT-ONLY',
            yearMonth: new Date().toISOString().slice(0, 7),
            amountAllocated: 0,
            paidTowardsBBF: 0,
            paidTowardsCurrentCharges: 0,
            previousBalance: 0,
            newBalance: 0,
            newAmountPaid: 0,
            newStatus: 'Overpayment',
            originalBBF: 0,
            newBBFValue: 0,
            bbfChanged: false,
            transactionId: transactionId,
            isOverpaymentOnly: true
        });
    }

    return {
        allocations,
        remainingPayment: totalPayment,
        updatedInvoices,
        glEntryRecordId,
        isOverpaymentOnly: true
    };
};

/**
 * Main payment approval function - UPDATED WITH WATER INVOICE FIX
 */
const approve_cash_payment = async (request, reply) => {
    try {
        console.log('=== Start: approve_cash_payment ===');

        const { facilityId, paymentId } = request.params;
        const { comments, paymentMethod } = request.body;
        const user = request.user;

    if (!facilityId || !paymentId) {
      return reply.code(400).send({
        success: false,
        message: "Missing required parameters",
      });
    }

    const CashPayment = await getModel(
      "CashPayment",
      payservedb.CashPayment.schema,
      facilityId,
    );
    if (!CashPayment) {
      return reply.code(400).send({
        success: false,
        message: "Failed to get CashPayment model",
      });
    }

    const payment = await CashPayment.findById(paymentId);
    if (!payment) {
      return reply.code(404).send({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.approvalStatus === "Approved") {
      return reply.code(400).send({
        success: false,
        message: "Payment already approved",
      });
    }

    if (payment.isVoided) {
      return reply.code(400).send({
        success: false,
        message: "Cannot approve a voided payment",
      });
    }

    const methodToUse = paymentMethod
      ? mapPaymentMethod(paymentMethod)
      : mapPaymentMethod(payment.paymentMethod);

    const validPaymentMethods = ["cash", "bank-transfer", "cheque"];
    if (!validPaymentMethods.includes(methodToUse)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payment method",
      });
    }

    const Facility = payservedb.Facility;
    const facility = await Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({
        success: false,
        message: "Facility not found",
      });
    }

    // Determine invoice type
    let invoiceType,
      invoiceModel,
      vasServiceModel = null;
    let isVasInvoice = false;
    let isWaterInvoice = false;
    let isBookingInvoice = false;

    if (payment.invoice.invoiceNumber.startsWith("WTR-")) {
      try {
        invoiceModel = await utilityDb.getModel("WaterInvoice");
      } catch (utilityDbErr) {
        throw new Error("Failed to access utility database for water invoices");
      }
      invoiceType = "waterinvoice";
      isWaterInvoice = true;
    } else if (payment.invoice.invoiceNumber.startsWith("VAS")) {
      invoiceModel = await getModel(
        "VasInvoice",
        payservedb.VasInvoice.schema,
        facilityId,
      );
      vasServiceModel = await getModel(
        "ValueAddedService",
        payservedb.ValueAddedService.schema,
        facilityId,
      );
      invoiceType = "vasinvoice";
      isVasInvoice = true;
    } else {
      // Try to load as regular invoice first
      invoiceModel = await getModel(
        "Invoice",
        payservedb.Invoice.schema,
        facilityId,
      );
      invoiceType = "invoice";

      // Check if it's a booking invoice by trying to find it in BookingInvoice collection
      // This is a fallback check that doesn't break existing functionality
      const BookingInvoiceModel = await getModel(
        "BookingInvoice",
        payservedb.BookingInvoice.schema,
        facilityId,
      );
      const bookingInvoiceCheck = await BookingInvoiceModel.findById(
        payment.invoice.invoiceId,
      );

      if (bookingInvoiceCheck) {
        // It's a booking invoice, use BookingInvoice model instead
        invoiceModel = BookingInvoiceModel;
        invoiceType = "bookinginvoice";
        isBookingInvoice = true;
        console.log(
          "[BOOKING-PAYMENT] Detected booking invoice:",
          payment.invoice.invoiceNumber,
        );
      }
    }

    if (!invoiceModel) {
      return reply.code(400).send({
        success: false,
        message: "Failed to get Invoice model",
      });
    }

    const targetInvoice = await invoiceModel.findById(
      payment.invoice.invoiceId,
    );
    if (!targetInvoice) {
      return reply.code(404).send({
        success: false,
        message: `Invoice ${payment.invoice.invoiceNumber} not found`,
      });
    }

    console.log(
      `Target invoice: ${targetInvoice.invoiceNumber}, account: ${targetInvoice.accountNumber}`,
    );

    let totalPaymentAmount = payment.paymentAmount;
    if (payment.exchangeRate && payment.exchangeRate.rate !== 1) {
      totalPaymentAmount = payment.paymentAmount * payment.exchangeRate.rate;
    }

        // For water invoices, we'll process ONLY the target invoice
        // For other invoices, use contract-based payment allocation
        let unpaidInvoices = [];
        let contractId = null;
        let invoiceTypeFromInvoice = null;

        if (isWaterInvoice) {
            // Water invoice: Only process the specific invoice being paid
            console.log(`[WATER-PAYMENT] Processing single water invoice: ${targetInvoice.invoiceNumber}`);

            // Check if invoice still has a balance
            const currentCharges = targetInvoice.charges?.totalMonthlyBill || 0;
            const previouslyPaid = targetInvoice.amountPaid || 0;
            const bbf = targetInvoice.balanceBroughtForward || 0;
            const invoiceBalance = currentCharges + bbf - previouslyPaid;

            if (invoiceBalance > 0) {
                unpaidInvoices = [targetInvoice];
            } else {
                console.log(`[WATER-PAYMENT] Invoice ${targetInvoice.invoiceNumber} is already fully paid`);
            }
        } else {
            // Non-water invoices: Use contract-based allocation
            contractId = targetInvoice.whatFor?.description;
            invoiceTypeFromInvoice = targetInvoice.whatFor?.invoiceType;

      if (!contractId) {
        return reply.code(400).send({
          success: false,
          message: "Contract ID not found in invoice. Cannot process payment.",
        });
      }

      unpaidInvoices = await findUnpaidInvoicesByContract(
        contractId,
        invoiceTypeFromInvoice,
        facilityId,
        invoiceModel,
        false,
      );
    }

    let allocations = [];
    let remainingPayment = totalPaymentAmount;
    let updatedInvoices = [];
    let glEntryRecordId = null;
    let isOverpaymentOnly = false;

        if (unpaidInvoices.length > 0) {
            if (isWaterInvoice) {
                // 🔧 Use simple water invoice payment allocation
                const waterPaymentResult = await applyWaterInvoicePayment(
                    unpaidInvoices[0],
                    totalPaymentAmount,
                    methodToUse,
                    payment,
                    invoiceModel,
                    facilityId,
                    user
                );
                allocations = waterPaymentResult.allocations;
                remainingPayment = waterPaymentResult.remainingPayment;
                updatedInvoices = waterPaymentResult.updatedInvoices;
                glEntryRecordId = waterPaymentResult.glEntryRecordId;
            } else {
                // 🔧 Apply payment with BBF reduction logic for non-water invoices
                const result = applyPaymentToInvoices(unpaidInvoices, totalPaymentAmount);
                allocations = result.allocations;
                remainingPayment = result.remainingPayment;

                // Update invoices in database
                for (const allocation of allocations) {
                    const transactionId = allocation.isBBFAdjustmentOnly
                        ? null // Don't create transaction ID for BBF-only adjustments
                        : `${methodToUse.toUpperCase()}-${Date.now().toString(36)}-${allocation.invoiceId.toString().slice(-4)}`;

                    // GL entry (only for first invoice that receives payment)
                    if (updatedInvoices.length === 0 && !allocation.isBBFAdjustmentOnly) {
                        try {
                            const doubleEntryModel = await getModel(
                                'GLAccountDoubleEntries',
                                payservedb.GLAccountDoubleEntries.schema,
                                facilityId
                            );

                            const invoice = unpaidInvoices.find(inv =>
                                inv._id.toString() === allocation.invoiceId.toString()
                            );

                            if (invoice && doubleEntryModel && invoice.paymentDoubleEntryAccount) {
                                const glEntryData = await processPaymentGLEntry(
                                    invoice, doubleEntryModel, totalPaymentAmount,
                                    methodToUse, transactionId, facilityId, user
                                );
                                if (glEntryData) {
                                    const glEntry = await doubleEntryModel.create(glEntryData);
                                    glEntryRecordId = glEntry._id;
                                }
                            }
                        } catch (glError) {
                            console.error('Error processing GL entry:', glError);
                        }
                    }

                    // 🔧 FIX: Build update object based on whether it's a payment or BBF-only adjustment
                    const updateObj = {
                        $set: {},
                        $push: {}
                    };

                    // Always update BBF if changed
                    if (allocation.bbfChanged) {
                        updateObj.$set.balanceBroughtForward = allocation.newBBFValue;
                        console.log(
                            `Updating ${allocation.invoiceNumber} BBF: ${allocation.originalBBF} → ${allocation.newBBFValue}`,
                        );
                    }

                    if (allocation.isBBFAdjustmentOnly) {
                        // 🔧 BBF-only adjustment (no payment applied to this invoice)
                        const reconciliationEntry = {
                            date: new Date(),
                            amount: 0,
                            type: 'bbf-adjustment',
                            paymentReference: payment.paymentReference || payment.receiptNumber || 'BBF-ADJUSTMENT',
                            notes: `BBF adjusted due to payment on earlier invoice(s)`,
                            paymentCompletion: '0%',
                            remainingBalance: allocation.newBalance,
                            allocationSource: payment._id,
                            balanceBroughtForwardUpdate: {
                                previousBBF: allocation.originalBBF,
                                newBBF: allocation.newBBFValue,
                                reduction: allocation.originalBBF - allocation.newBBFValue,
                                reason: 'Previous invoice(s) paid - BBF adjusted',
                            },
                        };

                        updateObj.$push.reconciliationHistory = reconciliationEntry;

                    } else {
                        // 🔧 Payment applied to this invoice
                        const paymentCompletionPercentage = allocation.previousBalance > 0
                            ? ((allocation.newAmountPaid / allocation.previousBalance) * 100).toFixed(2)
                            : '100.00';

                        const reconciliationEntry = {
                            date: new Date(),
                            amount: allocation.amountAllocated,
                            type: methodToUse,
                            paymentReference: payment.paymentReference || payment.receiptNumber || transactionId,
                            notes: `Payment allocation - ${allocation.newStatus}`,
                            paymentCompletion: `${paymentCompletionPercentage}%`,
                            remainingBalance: allocation.newBalance,
                            allocationSource: payment._id,
                            glEntryId: glEntryRecordId,
                            paymentBreakdown: {
                                towardsBBF: allocation.paidTowardsBBF,
                                towardsCurrentCharges: allocation.paidTowardsCurrentCharges
                            }
                        };

                        // Add BBF update info if changed
                        if (allocation.bbfChanged) {
                            reconciliationEntry.balanceBroughtForwardUpdate = {
                                previousBBF: allocation.originalBBF,
                                newBBF: allocation.newBBFValue,
                                reduction: allocation.originalBBF - allocation.newBBFValue,
                                reason: 'Previous invoice(s) paid - BBF adjusted before payment application'
                            };
                        }

                        updateObj.$set.amountPaid = allocation.newAmountPaid;
                        updateObj.$set.status = allocation.newStatus;
                        updateObj.$set.paymentMethod = methodToUse;
                        updateObj.$set.lastPaymentDate = new Date();
                        updateObj.$set.transactionReference = transactionId;
                        updateObj.$push.reconciliationHistory = reconciliationEntry;

                        if (!isWaterInvoice) {
                            updateObj.$set['paymentDetails.paymentStatus'] =
                                allocation.newBalance <= 0 ? 'Completed' : 'Partial';
                            updateObj.$set['paymentDetails.paymentMethod'] = methodToUse;
                            updateObj.$set['paymentDetails.paymentDate'] = new Date();
                            updateObj.$set['paymentDetails.transactionId'] = transactionId;
                        }
                    }

          const updatedInvoice = await invoiceModel.findByIdAndUpdate(
            allocation.invoiceId,
            updateObj,
            { new: true },
          );

                    if (updatedInvoice) {
                        updatedInvoices.push(updatedInvoice);
                        if (!allocation.isBBFAdjustmentOnly) {
                            allocation.transactionId = transactionId;
                        }
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
                                    type: 'overpayment',
                                    paymentReference: payment.paymentReference || payment.receiptNumber,
                                    notes: `Overpayment recorded - excess from ${totalPaymentAmount} payment`,
                                    remainingBalance: 0
                                }
                            }
                        },
                        { new: true }
                    );

                    // Update the last invoice in our array
                    const lastInvoiceIndex = updatedInvoices.length - 1;
                    updatedInvoices[lastInvoiceIndex].overpay = remainingPayment;

                    console.log(`✓ Overpayment recorded: ${remainingPayment}`);
                }
            }
        } else {
            // 🔧 NEW: Handle case where there are no unpaid invoices
            console.log(`No unpaid invoices found`);

            let mostRecentInvoice = null;

            if (isWaterInvoice) {
                // For water, use the target invoice for overpayment
                mostRecentInvoice = targetInvoice;
            } else {
                // For other invoices, find most recent by contract
                mostRecentInvoice = await findMostRecentInvoiceByContract(
                    contractId,
                    invoiceTypeFromInvoice,
                    facilityId,
                    invoiceModel,
                    false
                );
            }

      const overpaymentResult = await handleOverpaymentOnly(
        targetInvoice.accountNumber,
        totalPaymentAmount,
        invoiceModel,
        mostRecentInvoice,
        methodToUse,
        payment,
        facilityId,
        user,
      );

      allocations = overpaymentResult.allocations;
      remainingPayment = overpaymentResult.remainingPayment;
      updatedInvoices = overpaymentResult.updatedInvoices;
      glEntryRecordId = overpaymentResult.glEntryRecordId;
      isOverpaymentOnly = overpaymentResult.isOverpaymentOnly;
    }

    // Update account amounts - skip for water invoices and booking invoices (no account model)
    if (!isWaterInvoice && !isBookingInvoice && contractId) {
      await updateAccountAmountsByContract(
        contractId,
        facilityId,
        invoiceModel,
        allocations,
        remainingPayment,
      );
    } else if (isWaterInvoice) {
      console.log(
        "[WATER-PAYMENT] Skipping account update - water invoices use separate billing",
      );
    } else if (isBookingInvoice) {
      console.log(
        "[BOOKING-PAYMENT] Skipping account update - booking invoices use separate system",
      );
    }

    // Update cash payment record
    const reconciliationStatus =
      remainingPayment > 0
        ? "Overpaid"
        : allocations.some((alloc) => alloc.newBalance > 0)
          ? "Partial"
          : "Matched";

    const updatedPayment = await CashPayment.findByIdAndUpdate(
      paymentId,
      {
        $set: {
          approvalStatus: "Approved",
          paymentMethod: methodToUse,
          reconciliationStatus,
          approvedBy: {
            userId: user ? new mongoose.Types.ObjectId(user._id) : null,
            name: user ? `${user.firstName} ${user.lastName}` : "System",
            approvalDate: new Date(),
            comments: comments || "",
          },
          reconciliationDetails: {
            appliedAmount: totalPaymentAmount - remainingPayment,
            overpayAmount: remainingPayment > 0 ? remainingPayment : 0,
            reconciliationDate: new Date(),
            reconciledBy: user ? new mongoose.Types.ObjectId(user._id) : null,
            paymentMethod: methodToUse,
            paymentAllocations: allocations,
            glEntryId: glEntryRecordId,
            isOverpaymentOnly: isOverpaymentOnly,
          },
        },
      },
      { new: true },
    );

    // Send notifications with overpayment info
    await sendPaymentConfirmationMessages(
      updatedInvoices,
      allocations,
      totalPaymentAmount,
      methodToUse,
      facility,
      payment.receiptNumber || "N/A",
      remainingPayment,
    );

    // Property manager notifications (skip for water invoices and booking invoices)
    if (!isWaterInvoice && !isBookingInvoice) {
      for (const updatedInvoice of updatedInvoices) {
        if (updatedInvoice?.whatFor?.invoiceType === "Lease") {
          try {
            const allocation = allocations.find(
              (alloc) =>
                alloc.invoiceId.toString() === updatedInvoice._id.toString(),
            );
            if (!allocation) continue;

            const formattedAmount = allocation.amountAllocated.toFixed(2);
            const formattedBalance =
              allocation.newBalance > 0
                ? `Balance: ${allocation.newBalance.toFixed(2)}`
                : "Fully paid";
            const currencyCode = updatedInvoice.currency?.code || "KES";
            const facilityObjectId =
              updatedInvoice.facility?.id ||
              updatedInvoice.facility?._id ||
              updatedInvoice.facilityId;

                        // Add overpayment info
                        const overpayInfo = (updatedInvoice.overpay && updatedInvoice.overpay > 0)
                            ? ` Credit: ${updatedInvoice.overpay.toFixed(2)}`
                            : '';

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
                                const User = mongoose.model('User', payservedb.User.schema);
                                const propertyManagers = await User.find({
                                    type: 'Company',
                                    companies: company._id,
                                    $or: [
                                        {
                                            customerData: {
                                                $elemMatch: {
                                                    facilityId: facilityObjectId,
                                                    isEnabled: true
                                                }
                                            }
                                        },
                                        { role: 'admin' }
                                    ]
                                })
                                    .select('_id name firstName lastName email phoneNumber phone type isEnabled role')
                                    .lean();

                const paymentMethodDisplay =
                  {
                    cash: "Cash",
                    "bank-transfer": "Bank Transfer",
                    cheque: "Cheque",
                  }[methodToUse] || methodToUse;

                for (const manager of propertyManagers) {
                  if (manager.isEnabled === false) continue;

                  const managerPhone = manager.phoneNumber || manager.phone;
                  if (!managerPhone) continue;

                  let smsMessage;
                  if (isOverpaymentOnly) {
                    smsMessage = `${paymentMethodDisplay} overpayment received for account ${targetInvoice.accountNumber}. Amount: ${currencyCode} ${totalPaymentAmount.toFixed(2)}. Credit available for future invoices. Receipt: ${payment.receiptNumber}`;
                  } else {
                    smsMessage = `${paymentMethodDisplay} payment received for unit ${updatedInvoice.unit?.name} Lease Invoice #${updatedInvoice.invoiceNumber}. Amount: ${currencyCode} ${formattedAmount}. ${formattedBalance}.${overpayInfo} Receipt: ${allocation.transactionId}`;
                  }

                  const phoneDigits = managerPhone.replace(/\D/g, "");
                  const last9Digits = phoneDigits.slice(-9);

                  if (last9Digits.length === 9) {
                    await sendMessageToQueue(
                      "Payserve",
                      last9Digits,
                      "",
                      smsMessage,
                      "SMS Meliora",
                    );
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
    }

    console.log(`\n=== Payment Summary ===`);
    console.log(
      `Payment Type: ${isBookingInvoice ? "Booking Invoice (Single)" : isWaterInvoice ? "Water Invoice (Single)" : "Contract-based (Multiple)"}`,
    );
    console.log(`Total Payment: ${totalPaymentAmount}`);
    console.log(`Allocated: ${totalPaymentAmount - remainingPayment}`);
    console.log(`Across ${allocations.length} invoice(s)`);
    console.log(`Remaining/Overpay: ${remainingPayment}`);
    console.log(`Is Overpayment Only: ${isOverpaymentOnly}`);

    // Apply overpayment credit to other unpaid invoices with same account number and BBF
    let creditApplicationResult = null;
    if (
      remainingPayment > 0 &&
      !isOverpaymentOnly &&
      targetInvoice?.accountNumber
    ) {
      try {
        console.log(
          `\n💰 Attempting to apply overpayment credit to account ${targetInvoice.accountNumber}...`,
        );

        creditApplicationResult = await applyOverpaymentToAccount({
          facilityId: facilityId,
          accountNumber: targetInvoice.accountNumber,
          overpaymentAmount: remainingPayment,
          sourceInvoiceNumber: targetInvoice.invoiceNumber,
          paymentMode: methodToUse,
          referenceNumber: payment.receiptNumber,
        });

        if (
          creditApplicationResult.success &&
          creditApplicationResult.creditsApplied > 0
        ) {
          console.log(
            `✅ Applied ${creditApplicationResult.creditsApplied} in credits to ${creditApplicationResult.invoices.length} invoice(s)`,
          );
          // Update remaining payment to reflect credits that were applied
          remainingPayment = creditApplicationResult.remainingCredit;
        } else {
          console.log(
            `⚠️ No eligible invoices found to apply overpayment credit`,
          );
        }
      } catch (error) {
        console.error(
          `⚠️ Failed to apply overpayment credit (non-fatal):`,
          error.message,
        );
        // Don't fail the payment approval if credit application fails
      }
    }

    // ============================================================================
    // STEP: Send Payments to Zoho Books (if integration enabled)
    // ============================================================================

    // Get currency code from target invoice or contract
    const currencyCode =
      targetInvoice?.currency?.code ||
      updatedInvoices[0]?.currency?.code ||
      "KES";

    console.log(`\n📤 Checking if Zoho Books integration is enabled...`);

    try {
      // Check if facility has Zoho integration
      const ZohoIntegrationModel = await getModel(
        "ZohoIntegration",
        payservedb.ZohoIntegration.schema,
        facilityId,
      );

      const zohoConfig = await ZohoIntegrationModel.findOne({
        facilityId,
        isActive: true,
      });

      if (zohoConfig && zohoConfig.syncPaymentsOnReceipt !== false) {
        console.log(
          `✅ Zoho integration enabled - syncing payment to Zoho Books`,
        );

        // ============================================================================
        // NEW APPROACH: Use record-for-account endpoint
        // This distributes the TOTAL payment across ALL unpaid Zoho invoices
        // for this account, handling the BBF mismatch between PayServe and Zoho
        // ============================================================================
        try {
          const accountNumber = targetInvoice?.accountNumber;

          if (!accountNumber) {
            console.warn(
              `   ⚠️  No account number found - falling back to invoice-by-invoice sync`,
            );
            // Fallback: Send payment for target invoice only
            if (allocations.length > 0) {
              const allocation = allocations[0];
              const zohoPaymentResponse = await axios.post(
                `${process.env.BACKEND_URL}/api/integrations/zoho/payments/record-by-number`,
                {
                  facilityId: facilityId.toString(),
                  invoiceNumber: allocation.invoiceNumber,
                  amount: totalPaymentAmount,
                  paymentMode:
                    methodToUse === "bank-transfer"
                      ? "bank_transfer"
                      : methodToUse,
                  referenceNumber:
                    allocation.transactionId || payment.receiptNumber,
                  paymentDate: new Date().toISOString().split("T")[0],
                  description: `Payment - Receipt: ${payment.receiptNumber}`,
                },
              );
              if (zohoPaymentResponse.data.success) {
                console.log(`   ✅ Payment recorded in Zoho Books`);
              }
            }
          } else {
            console.log(`\n💳 Recording payment for account: ${accountNumber}`);
            console.log(
              `   Total Payment Amount: ${currencyCode} ${totalPaymentAmount}`,
            );
            console.log(`   Receipt: ${payment.receiptNumber}`);
            console.log(
              `   This will distribute payment across ALL unpaid Zoho invoices for this account`,
            );

            // Call the new record-for-account endpoint
            // This endpoint will:
            // 1. Find ALL unpaid invoices for this account in Zoho
            // 2. Allocate payment across all invoices (oldest first)
            // 3. Record any overpayment as customer credit
            const zohoPaymentResponse = await axios.post(
              `${process.env.BACKEND_URL}/api/integrations/zoho/payments/record-for-account`,
              {
                facilityId: facilityId.toString(),
                accountNumber: accountNumber,
                totalPayment: totalPaymentAmount,
                paymentMode:
                  methodToUse === "bank-transfer"
                    ? "bank_transfer"
                    : methodToUse,
                referenceNumber: payment.receiptNumber,
                paymentDate: new Date().toISOString().split("T")[0],
                description: `Payment for account ${accountNumber} - Receipt: ${payment.receiptNumber}`,
              },
            );

            if (zohoPaymentResponse.data.success) {
              const zohoResult = zohoPaymentResponse.data.data;
              console.log(`\n   ✅ Zoho payment sync completed successfully`);
              console.log(
                `   📊 Total Applied to Invoices: ${currencyCode} ${zohoResult.totalAppliedToInvoices}`,
              );
              console.log(
                `   📄 Invoices Fully Paid: ${zohoResult.invoicesPaidFully}`,
              );
              console.log(
                `   📄 Invoices Partially Paid: ${zohoResult.invoicesPaidPartially}`,
              );
              if (zohoResult.customerCredit > 0) {
                console.log(
                  `   💰 Customer Credit (Overpayment): ${currencyCode} ${zohoResult.customerCredit}`,
                );
                if (zohoResult.customerCreditResult?.paymentId) {
                  console.log(
                    `   💳 Credit Payment ID: ${zohoResult.customerCreditResult.paymentId}`,
                  );
                }
              }
            } else {
              console.warn(
                `   ⚠️  Zoho payment sync returned non-success: ${zohoPaymentResponse.data.message}`,
              );
              console.log(
                `   ℹ️  Payment approved locally but may not be fully synced to Zoho`,
              );
            }
          }
        } catch (zohoError) {
          // Non-fatal: Log error but don't fail the entire payment approval
          console.error(
            `   ❌ Failed to sync payment to Zoho:`,
            zohoError.response?.data?.error || zohoError.message,
          );
          console.error(
            `   Payment approved locally but not synced to Zoho Books`,
          );
        }

        console.log(`\n✅ Zoho payment recording complete`);
      } else {
        console.log(
          `ℹ️  Zoho integration not enabled or payment sync disabled - skipping Zoho payment recording`,
        );
      }
    } catch (zohoCheckError) {
      console.error(
        `⚠️  Error checking Zoho integration:`,
        zohoCheckError.message,
      );
      console.log(`   Continuing with local payment approval...`);
    }

        return reply.code(200).send({
            success: true,
            message: isOverpaymentOnly
                ? `Payment recorded as overpayment - no unpaid invoices found. Credit of ${totalPaymentAmount} available for future invoices.`
                : isWaterInvoice
                    ? `Water invoice payment processed successfully${remainingPayment > 0 ? ` with ${remainingPayment} overpayment recorded` : ''}`
                    : remainingPayment > 0
                        ? `Payment processed successfully with ${remainingPayment} overpayment recorded`
                        : allocations.length > 1
                            ? `Payment allocated across ${allocations.length} invoices chronologically`
                            : 'Payment approved successfully',
            data: {
                payment: updatedPayment,
                allocations: allocations.map(alloc => ({
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
                    isOverpaymentOnly: alloc.isOverpaymentOnly || false
                })),
                totalAllocated: totalPaymentAmount - remainingPayment,
                overpayAmount: remainingPayment,
                affectedInvoices: updatedInvoices.length,
                isChronologicalPayment: allocations.length > 1,
                glEntryProcessed: !!glEntryRecordId,
                invoiceType: isWaterInvoice ? 'water' : (isVasInvoice ? 'vas' : 'regular'),
                isOverpaymentOnly: isOverpaymentOnly,
                receipt: {
                    receiptNumber: payment.receiptNumber,
                    transactionId: allocations[0]?.transactionId,
                    amount: totalPaymentAmount,
                    paymentDate: new Date(),
                    accountNumber: targetInvoice.accountNumber,
                    invoiceNumbers: allocations.map(alloc => alloc.invoiceNumber),
                    overpaymentRecorded: remainingPayment > 0,
                    isOverpaymentOnly: isOverpaymentOnly
                }
            }
        });

    } catch (err) {
        console.error('Error approving cash payment:', err);
        console.error('Error stack:', err.stack);
        return reply.code(400).send({
            success: false,
            message: err.message || 'Failed to approve cash payment'
        });
    } finally {
        console.log('=== End: approve_cash_payment ===');
    }
};

module.exports = approve_cash_payment;
