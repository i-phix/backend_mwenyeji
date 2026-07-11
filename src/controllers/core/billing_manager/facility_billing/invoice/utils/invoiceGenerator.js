const payservedb = require("payservedb");
const cron = require("node-cron");
const mongoose = require("mongoose");
const axios = require("axios");

// API Endpoints Configuration - Move these to .env file later
const POWER_METERS_API_URL =
  process.env.POWER_METERS_API_URL ||
  "https://api.payserve.co.ke/power_meters/v1/api/app/facility_meters_count";
const WATER_METERS_API_URL =
  process.env.WATER_METERS_API_URL ||
  "https://meters.payserve.co.ke/api/v1/utility/water/facility_installed_meters";

class InvoiceGenerator {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Helper function to ensure URL has proper protocol
   */
  formatUrl(url) {
    if (!url || url.trim() === "") return "";
    const trimmedUrl = url.trim();
    // Check if URL already has protocol
    if (trimmedUrl.match(/^https?:\/\//i)) {
      return trimmedUrl;
    }
    // Add https:// if missing
    return `https://${trimmedUrl}`;
  }

  /**
   * Helper function to validate and format email
   */
  formatEmail(email) {
    if (!email || email.trim() === "") return "";
    const trimmedEmail = email.trim();
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmedEmail)) {
      return trimmedEmail;
    }
    // If email doesn't have @, it might be malformed (e.g., "payserve.gmail.com" instead of "payserve@gmail.com")
    // Try to fix common mistakes
    if (!trimmedEmail.includes("@") && trimmedEmail.includes(".")) {
      // Can't reliably fix, return empty to avoid validation error
      return "";
    }
    return "";
  }

  /**
   * Generate invoices for all facilities
   * @param {Array} months - Array of months in YYYY-MM format, e.g., ['2024-01', '2024-02']
   */
  async generateInvoices(months = []) {
    try {
      console.log("Starting invoice generation process...");
      this.isRunning = true;

      // If no months specified, use current month
      const targetMonths =
        months.length > 0 ? months : [this.getCurrentMonth()];
      console.log(`Target months: ${targetMonths.join(", ")}`);

      // Get all facilities
      const facilities = await payservedb.Facility.find({});

      let totalInvoicesGenerated = 0;
      let errors = [];

      for (const facility of facilities) {
        try {
          const facilityResult = await this.generateInvoicesForFacility(
            facility._id,
            targetMonths,
          );
          totalInvoicesGenerated += facilityResult.count;
          console.log(
            `Generated ${facilityResult.count} invoices for facility: ${facility.name}`,
          );
        } catch (error) {
          console.error(
            `Error generating invoices for facility ${facility.name}:`,
            error.message,
          );
          errors.push({
            facilityId: facility._id,
            facilityName: facility.name,
            error: error.message,
          });
        }
      }

      console.log(
        `Invoice generation completed. Total invoices generated: ${totalInvoicesGenerated}`,
      );

      if (errors.length > 0) {
        console.warn("Some facilities had errors:", errors);
      }

      this.isRunning = false;
      return {
        success: true,
        totalInvoicesGenerated,
        facilitiesProcessed: facilities.length,
        monthsProcessed: targetMonths,
        errors,
      };
    } catch (error) {
      console.error("Invoice generation failed:", error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Generate invoices for a specific facility
   * @param {String} facilityId - The facility ID
   * @param {Array} months - Array of months in YYYY-MM format
   */
  async generateInvoicesForFacility(facilityId, months = []) {
    try {
      // If no months specified, use current month
      const targetMonths =
        months.length > 0 ? months : [this.getCurrentMonth()];
      console.log(
        `Generating invoices for facility ${facilityId}, months: ${targetMonths.join(", ")}`,
      );

      // Get facility details
      const facility = await payservedb.Facility.findById(facilityId);
      if (!facility) {
        throw new Error(`Facility not found: ${facilityId}`);
      }

      // Get company settings for invoice header/footer
      const company = await payservedb.Company.findOne({ isEnabled: true });
      const invoiceSettings = await payservedb.CoreInvoiceSettings.findOne();

      // Get facility pricing
      const facilityPricing = await payservedb.FacilityBillingPrice.findOne({
        facilityId,
      });

      if (!facilityPricing) {
        console.log(`No pricing found for facility: ${facility.name}`);
        return { count: 0, invoices: [], months: targetMonths };
      }

      // Get facility recipients
      const recipients = await payservedb.Recipient.find({ facilityId });

      if (recipients.length === 0) {
        console.log(`No recipients found for facility: ${facility.name}`);
        return { count: 0, invoices: [], months: targetMonths };
      }

      // Get active units data for the facility using the same logic
      const facilityUnitsData = await this.getFacilityUnitsData(facilityId);

      if (facilityUnitsData.totalActiveUnits === 0) {
        console.log(
          `No units found for facility: ${facility.name}. Facility is inactive.`,
        );
        return { count: 0, invoices: [], months: targetMonths };
      }

      const generatedInvoices = [];

      // Generate invoices for each month
      for (const month of targetMonths) {
        console.log(
          `Processing month: ${month} for facility: ${facility.name}`,
        );

        // Generate invoices for each recipient
        for (const recipient of recipients) {
          // Check if invoice already exists for this month
          const existingInvoice = await this.checkDuplicateInvoice(
            facilityId,
            recipient._id,
            month,
          );

          if (existingInvoice) {
            console.log(
              `Invoice already exists for facility ${facility.name}, recipient ${recipient.email}, month ${month}. Skipping.`,
            );
            continue;
          }

          const invoiceData = await this.createInvoiceData(
            facility,
            recipient,
            facilityUnitsData,
            facilityPricing,
            company,
            invoiceSettings,
            month,
          );

          const invoice = new payservedb.FacilityInvoice(invoiceData);
          await invoice.save();

          generatedInvoices.push(invoice);
          console.log(
            `Created invoice ${invoice.invoiceNumber} for ${recipient.email} - ${month}`,
          );
        }
      }

      return {
        count: generatedInvoices.length,
        invoices: generatedInvoices,
        months: targetMonths,
      };
    } catch (error) {
      console.error(
        `Error generating invoices for facility ${facilityId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get facility units data using the same logic as get_active_units_for_facility
   * Also calculates SMS free allowance based on total units
   */
  async getFacilityUnitsData(facilityId) {
    const { getModel } = require("../../../../../../utils/getModel");

    const unitModel = await getModel(
      "Unit",
      payservedb.Unit.schema,
      facilityId,
    );

    // Retrieve the tenant-specific Invoice model
    const invoiceModel = await getModel(
      "Invoice",
      payservedb.Invoice.schema,
      facilityId,
    );

    // Get all units for the facility - every unit should be billed
    const units = await unitModel.find({ facilityId });

    // Query invoices to find units with Contract and Lease types
    const contractInvoices = await invoiceModel.distinct("unit.id", {
      "facility.id": new mongoose.Types.ObjectId(facilityId),
      "whatFor.invoiceType": "Contract",
    });

    const leaseInvoices = await invoiceModel.distinct("unit.id", {
      "facility.id": new mongoose.Types.ObjectId(facilityId),
      "whatFor.invoiceType": "Lease",
    });

    // Get unit IDs that have existing invoices
    const unitIdsWithContract = contractInvoices.map((id) => id.toString());
    const unitIdsWithLease = leaseInvoices.map((id) => id.toString());

    // Count units with contract invoices
    const unitsWithContract = units.filter((unit) =>
      unitIdsWithContract.includes(unit._id.toString()),
    ).length;

    // Count units with lease invoices
    const unitsWithLease = units.filter((unit) =>
      unitIdsWithLease.includes(unit._id.toString()),
    ).length;

    // Units without existing contract or lease invoices should be billed as levy
    const unitsWithoutInvoices = units.filter((unit) => {
      const unitIdStr = unit._id.toString();
      return (
        !unitIdsWithContract.includes(unitIdStr) &&
        !unitIdsWithLease.includes(unitIdStr)
      );
    }).length;

    // Total contract units = existing contract units + units without invoices (default to levy/contract)
    const totalContractUnits = unitsWithContract + unitsWithoutInvoices;

    return {
      units: units, // Return ALL units
      unitsWithContract: totalContractUnits,
      unitsWithLease: unitsWithLease,
      totalActiveUnits: units.length, // All units count as active
    };
  }

  /**
   * Calculate balance brought forward from previous invoices
   * Returns positive for outstanding balance (debt), negative for overpayment (credit)
   *
   * Logic: For each previous invoice, calculate the unpaid portion of ONLY that invoice's charges
   * (excluding any balance brought forward that invoice already had)
   */
  async calculateBalanceBroughtForward(
    facilityId,
    recipientEmail,
    currentInvoiceDate,
  ) {
    try {
      console.log(
        `[Balance Calculation] ========================================`,
      );
      console.log(
        `[Balance Calculation] Calculating balance for Facility: ${facilityId}`,
      );
      console.log(`[Balance Calculation] Recipient: ${recipientEmail}`);
      console.log(
        `[Balance Calculation] Current Invoice Date: ${currentInvoiceDate.toISOString()}`,
      );

      // Get all previous invoices for this facility and recipient (before current invoice date)
      const previousInvoices = await payservedb.FacilityInvoice.find({
        facilityId,
        "recipient.email": recipientEmail,
        invoiceDate: { $lt: currentInvoiceDate },
      }).sort({ invoiceDate: 1 }); // Sort ascending (oldest first)

      if (previousInvoices.length === 0) {
        console.log("[Balance Calculation] No previous invoices found");
        console.log(
          `[Balance Calculation] ========================================`,
        );
        return 0;
      }

      console.log(
        `[Balance Calculation] Found ${previousInvoices.length} previous invoice(s)`,
      );

      let balanceBroughtForward = 0;

      // Calculate balance for each previous invoice
      for (const invoice of previousInvoices) {
        // Get all valid payments for this invoice
        const payments = await payservedb.FacilityInvoicePayment.find({
          invoiceId: invoice._id,
          status: { $in: ["pending", "paid", "overpaid"] }, // Exclude rejected
        });

        const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);

        // Calculate the invoice's own charges (subtotal + tax)
        // This is the amount WITHOUT any previous balance brought forward
        const invoiceOwnCharges = invoice.subtotal
          ? invoice.subtotal + (invoice.taxAmount || 0)
          : invoice.amount; // Fallback for old invoices without subtotal field

        // Get the balance brought forward that was already included in this invoice
        const previousBalanceInThisInvoice = invoice.balanceBroughtForward || 0;

        // Calculate current invoice balance
        // Total amount customer owes = invoice.amount (which includes previous balance)
        // Subtract what they've paid
        const currentInvoiceBalance = invoice.amount - totalPaid;

        // Add to running total
        balanceBroughtForward += currentInvoiceBalance;

        console.log(
          `[Balance Calculation] -----------------------------------`,
        );
        console.log(
          `[Balance Calculation] Invoice: ${invoice.invoiceNumber} (${new Date(invoice.invoiceDate).toLocaleDateString()})`,
        );
        console.log(
          `[Balance Calculation]   Subtotal: ${invoice.subtotal || "N/A"}`,
        );
        console.log(
          `[Balance Calculation]   Tax: ${invoice.taxAmount || "N/A"}`,
        );
        console.log(
          `[Balance Calculation]   Previous Balance: ${previousBalanceInThisInvoice >= 0 ? "+" : ""}${previousBalanceInThisInvoice}`,
        );
        console.log(`[Balance Calculation]   Total Amount: ${invoice.amount}`);
        console.log(
          `[Balance Calculation]   Total Paid: ${totalPaid} (${payments.length} payment(s))`,
        );
        console.log(
          `[Balance Calculation]   Balance: ${currentInvoiceBalance >= 0 ? "+" : ""}${currentInvoiceBalance.toFixed(2)} ${currentInvoiceBalance > 0 ? "(Owed)" : currentInvoiceBalance < 0 ? "(Credit)" : "(Settled)"}`,
        );
      }

      console.log(`[Balance Calculation] -----------------------------------`);
      console.log(
        `[Balance Calculation] TOTAL Balance Brought Forward: ${balanceBroughtForward >= 0 ? "+" : ""}${balanceBroughtForward.toFixed(2)}`,
      );
      console.log(
        `[Balance Calculation] Status: ${balanceBroughtForward > 0 ? "OUTSTANDING DEBT" : balanceBroughtForward < 0 ? "CREDIT AVAILABLE" : "ALL SETTLED"}`,
      );
      console.log(
        `[Balance Calculation] ========================================`,
      );

      return balanceBroughtForward;
    } catch (error) {
      console.error(
        "[Balance Calculation] ERROR calculating balance brought forward:",
        error.message,
      );
      console.error("[Balance Calculation] Stack:", error.stack);
      return 0; // Return 0 if there's an error
    }
  }

  /**
   * Recalculate and update balance brought forward for all invoices after a specific date
   * This should be called after:
   * 1. A payment is made on an invoice
   * 2. A retroactive invoice is created
   * 3. A payment is cancelled/rejected
   */
  async recalculateBalancesAfterDate(facilityId, recipientEmail, fromDate) {
    try {
      console.log(
        `[Balance Recalculation] ========================================`,
      );
      console.log(
        `[Balance Recalculation] Starting recalculation for facility ${facilityId}, recipient ${recipientEmail}`,
      );
      console.log(
        `[Balance Recalculation] From date: ${fromDate.toISOString()}`,
      );

      // Get all invoices from the date onwards, sorted by date
      const invoicesToUpdate = await payservedb.FacilityInvoice.find({
        facilityId,
        "recipient.email": recipientEmail,
        invoiceDate: { $gte: fromDate },
      }).sort({ invoiceDate: 1 });

      if (invoicesToUpdate.length === 0) {
        console.log(
          `[Balance Recalculation] No invoices to recalculate after ${fromDate.toISOString()}`,
        );
        return { updated: 0, invoices: [] };
      }

      console.log(
        `[Balance Recalculation] Found ${invoicesToUpdate.length} invoice(s) to recalculate`,
      );

      const updatedInvoices = [];

      for (const invoice of invoicesToUpdate) {
        // Calculate new balance brought forward for this invoice
        const newBalanceBF = await this.calculateBalanceBroughtForward(
          facilityId,
          recipientEmail,
          invoice.invoiceDate,
        );

        const oldBalanceBF = invoice.balanceBroughtForward || 0;

        // Only update if balance has changed
        if (Math.abs(newBalanceBF - oldBalanceBF) > 0.01) {
          // Recalculate total amount
          const subtotal = invoice.subtotal || 0;
          const taxAmount = invoice.taxAmount || 0;
          const newTotalAmount = subtotal + taxAmount + newBalanceBF;

          console.log(
            `[Balance Recalculation] Updating invoice ${invoice.invoiceNumber}:`,
          );
          console.log(
            `[Balance Recalculation]   Old Balance BF: ${oldBalanceBF}`,
          );
          console.log(
            `[Balance Recalculation]   New Balance BF: ${newBalanceBF}`,
          );
          console.log(`[Balance Recalculation]   Old Total: ${invoice.amount}`);
          console.log(`[Balance Recalculation]   New Total: ${newTotalAmount}`);

          // Update the invoice
          invoice.balanceBroughtForward = newBalanceBF;
          invoice.amount = newTotalAmount;
          await invoice.save();

          updatedInvoices.push({
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            oldBalance: oldBalanceBF,
            newBalance: newBalanceBF,
            oldAmount: invoice.amount,
            newAmount: newTotalAmount,
          });

          // Check if invoice payment status needs updating
          const payments = await payservedb.FacilityInvoicePayment.find({
            invoiceId: invoice._id,
            status: { $in: ["pending", "paid", "overpaid"] },
          });

          const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
          let newInvoiceStatus = "pending";

          if (totalPaid === 0) {
            newInvoiceStatus = "pending";
          } else if (totalPaid >= newTotalAmount) {
            newInvoiceStatus = "paid";
          } else if (totalPaid > 0) {
            newInvoiceStatus = "partially_paid";
          }

          if (invoice.status !== newInvoiceStatus) {
            invoice.status = newInvoiceStatus;
            await invoice.save();
            console.log(
              `[Balance Recalculation]   Updated status: ${invoice.status} -> ${newInvoiceStatus}`,
            );
          }
        } else {
          console.log(
            `[Balance Recalculation] No change for invoice ${invoice.invoiceNumber} (balance: ${newBalanceBF})`,
          );
        }
      }

      console.log(
        `[Balance Recalculation] Completed. Updated ${updatedInvoices.length} invoice(s)`,
      );
      console.log(
        `[Balance Recalculation] ========================================`,
      );

      return { updated: updatedInvoices.length, invoices: updatedInvoices };
    } catch (error) {
      console.error(
        "[Balance Recalculation] Error recalculating balances:",
        error.message,
      );
      console.error("[Balance Recalculation] Stack:", error.stack);
      return { updated: 0, invoices: [], error: error.message };
    }
  }

  /**
   * Create invoice data structure
   * @param {String} invoiceMonth - Month in YYYY-MM format (e.g., '2024-01')
   */
  async createInvoiceData(
    facility,
    recipient,
    facilityUnitsData,
    facilityPricing,
    company,
    invoiceSettings,
    invoiceMonth = null,
  ) {
    // Parse the month to get invoice date
    let invoiceDate;
    if (invoiceMonth) {
      const [year, month] = invoiceMonth.split("-");
      // Use UTC to avoid timezone issues - set to first day of the month at midnight
      invoiceDate = new Date(
        Date.UTC(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0),
      );
      console.log(
        `[Invoice Generator] Creating invoice for month ${invoiceMonth}, date: ${invoiceDate.toISOString()}, Display: ${invoiceDate.toLocaleDateString()}`,
      );
    } else {
      invoiceDate = new Date();
      console.log(
        `[Invoice Generator] Creating invoice for current month, date: ${invoiceDate.toISOString()}`,
      );
    }

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(invoiceDate.getDate() + 30); // 30 days from invoice date

    // Generate unique invoice number
    const invoiceNumber = await this.generateInvoiceNumber(
      facility._id,
      invoiceMonth,
    );

    // Create invoice items based on facility units
    const items = await this.createInvoiceItems(
      facilityUnitsData,
      facility,
      facilityPricing,
      invoiceMonth,
    );

    // Calculate balance brought forward from previous invoices
    const balanceBroughtForward = await this.calculateBalanceBroughtForward(
      facility._id,
      recipient.email,
      invoiceDate,
    );

    // Calculate totals
    const subtotal = items.reduce((total, item) => total + item.amount, 0);
    const taxRate = parseFloat(invoiceSettings?.footer?.taxRate) || 16; // Get from settings or default to 16
    const taxAmount = (subtotal * taxRate) / 100;
    const totalBeforeBalance = subtotal + taxAmount;

    // Add balance brought forward to get final total
    // Positive balance = debt (adds to invoice)
    // Negative balance = credit (reduces invoice)
    const totalAmount = totalBeforeBalance + balanceBroughtForward;

    return {
      facilityId: facility._id,
      // Create a dummy contract ID since it's required by the schema but we're not using contracts
      facilityInvoiceContract: new mongoose.Types.ObjectId(),
      recipient: {
        facilityId: recipient.facilityId,
        phoneNumber: recipient.phoneNumber,
        email: recipient.email,
      },
      invoiceNumber,
      invoiceDate,
      dueDate,
      status: "pending",
      invoiceType: "unit",
      items,
      subtotal: subtotal,
      balanceBroughtForward: balanceBroughtForward,
      amount: totalAmount,
      taxRate,
      taxAmount: taxAmount,
      reminders: [
        {
          frequency: "daily",
          startDate: dueDate,
          status: "pending",
        },
      ],
      // Use CoreInvoiceSettings for header data, fallback to Company model if needed
      header: {
        companyName:
          invoiceSettings?.header?.companyName ||
          company?.name ||
          "Payserve Limited",
        companyAddress:
          invoiceSettings?.header?.companyAddress ||
          company?.address ||
          "Westlands Nairobi",
        companyPhone:
          invoiceSettings?.header?.companyPhone || company?.phone || "",
        companyEmail: this.formatEmail(
          invoiceSettings?.header?.companyEmail || company?.email || "",
        ),
        companyWebsite: this.formatUrl(
          invoiceSettings?.header?.companyWebsite || company?.website || "",
        ),
        taxNumber:
          invoiceSettings?.header?.taxNumber || company?.companyTaxNumber || "",
        logo: invoiceSettings?.header?.logo || company?.logo || null,
      },
      // Use CoreInvoiceSettings for footer data
      footer: {
        bankName: invoiceSettings?.footer?.bankName || "",
        accountName: invoiceSettings?.footer?.accountName || "",
        accountNumber: invoiceSettings?.footer?.accountNumber || "",
        swiftCode: invoiceSettings?.footer?.swiftCode || "",
        paymentTerms: invoiceSettings?.footer?.paymentTerms || "Net 30 days",
        latePaymentFee: invoiceSettings?.footer?.latePaymentFee || "",
        additionalNotes: invoiceSettings?.footer?.additionalNotes || "",
        supportEmail: this.formatEmail(
          invoiceSettings?.footer?.supportEmail || company?.email || "",
        ),
        supportPhone:
          invoiceSettings?.footer?.supportPhone || company?.phone || "",
        termsAndConditions: invoiceSettings?.footer?.termsAndConditions || "",
      },
    };
  }

  /**
   * Create invoice items based on facility units data
   */
  async createInvoiceItems(
    facilityUnitsData,
    facility,
    facilityPricing,
    invoiceMonth = null,
  ) {
    const items = [];

    // Add contract units if any (using levy pricing)
    if (facilityUnitsData.unitsWithContract > 0) {
      const levyPrice = facilityPricing.levy || 0;
      items.push({
        itemType: "unit",
        name: "Levy",
        description: `Levy charges for contract units at ${facility.name}`,
        detail: `${facilityUnitsData.unitsWithContract} units at ${levyPrice} per unit`,
        quantity: facilityUnitsData.unitsWithContract,
        unitPrice: levyPrice,
        amount: facilityUnitsData.unitsWithContract * levyPrice,
      });
    }

    // Add lease units if any (using lease pricing)
    if (facilityUnitsData.unitsWithLease > 0) {
      const leasePrice = facilityPricing.lease || 0;
      items.push({
        itemType: "unit",
        name: "Lease Units",
        description: `Lease charges for units at ${facility.name}`,
        detail: `${facilityUnitsData.unitsWithLease} units at ${leasePrice} per unit`,
        quantity: facilityUnitsData.unitsWithLease,
        unitPrice: leasePrice,
        amount: facilityUnitsData.unitsWithLease * leasePrice,
      });
    }

    // Add power meters if configured
    const powerMeterData = await this.getFacilityMeterData(facility._id);
    if (powerMeterData.powerMeters > 0 && facilityPricing.powerMeters) {
      const powerMeterPrice = facilityPricing.powerMeters || 0;
      items.push({
        itemType: "powerMeters",
        name: "Power Meters",
        description: `Power meter charges for ${facility.name}`,
        detail: `${powerMeterData.powerMeters} meters at ${powerMeterPrice} per meter`,
        quantity: powerMeterData.powerMeters,
        unitPrice: powerMeterPrice,
        amount: powerMeterData.powerMeters * powerMeterPrice,
      });
    }

    // Add water meters if configured
    if (powerMeterData.waterMeters > 0 && facilityPricing.waterMeters) {
      const waterMeterPrice = facilityPricing.waterMeters || 0;
      items.push({
        itemType: "coldWaterMeters",
        name: "Water Meters",
        description: `Water meter charges for ${facility.name}`,
        detail: `${powerMeterData.waterMeters} meters at ${waterMeterPrice} per meter`,
        quantity: powerMeterData.waterMeters,
        unitPrice: waterMeterPrice,
        amount: powerMeterData.waterMeters * waterMeterPrice,
      });
    }

    // Add SMS billing (10 free SMS per unit per month)
    const smsData = await this.getFacilitySmsData(facility._id, invoiceMonth);
    if (smsData && smsData.totalSms > 0) {
      // Calculate free SMS allowance: 10 SMS per unit
      const freeAllowance = facilityUnitsData.totalActiveUnits * 10;
      const billableCount = Math.max(0, smsData.totalSms - freeAllowance);

      console.log(
        `[SMS Billing] Facility ${facility.name} - Total SMS: ${smsData.totalSms}, Free allowance: ${freeAllowance}, Billable: ${billableCount}`,
      );

      if (billableCount > 0 && smsData.totalCost > 0) {
        // Calculate cost per SMS from actual provider cost
        const costPerSms = smsData.totalCost / smsData.totalSms;
        const billableAmount = billableCount * costPerSms;

        console.log(
          `[SMS Billing] Cost per SMS: ${costPerSms.toFixed(4)}, Billable amount: ${billableAmount.toFixed(2)}`,
        );

        items.push({
          itemType: "sms",
          name: "SMS Charges",
          description: `SMS charges for ${facility.name}`,
          detail: `${smsData.totalSms} SMS sent, ${freeAllowance} free (${facilityUnitsData.totalActiveUnits} units × 10), ${billableCount} billable at ${costPerSms.toFixed(4)} per SMS`,
          quantity: billableCount,
          unitPrice: parseFloat(costPerSms.toFixed(4)),
          amount: parseFloat(billableAmount.toFixed(2)),
        });
      }
    }

    return items;
  }

  /**
   * Get facility SMS data for a specific month from communications service
   */
  async getFacilitySmsData(facilityId, invoiceMonth = null) {
    try {
      const COMMUNICATIONS_ENDPOINT =
        process.env.COMMUNICATIONS_ENDPOINT ||
        "https://communications.payserve.co.ke";

      // Use the invoice month or current month (YYYY-MM format)
      const month = invoiceMonth || this.getCurrentMonth();

      console.log(
        `[SMS Billing] Fetching SMS data for facility ${facilityId}, month: ${month}`,
      );

      const url = `${COMMUNICATIONS_ENDPOINT}/api/sms/facility/${facilityId}/month-summary?month=${month}`;

      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
      });

      if (response.data && response.data.success) {
        const summary = response.data.data.summary;
        const totalSms = summary.totalSms || 0;

        console.log(
          `[SMS Billing] Facility ${facilityId} - Total SMS: ${totalSms}`,
        );

        return {
          totalSms: totalSms,
          totalCost: summary.totalCost || 0,
        };
      }

      console.log(`[SMS Billing] No SMS data found for facility ${facilityId}`);
      return null;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        console.warn(
          `[SMS Billing] Timeout fetching SMS data for facility ${facilityId}`,
        );
      } else if (error.response?.status === 404) {
        console.log(
          `[SMS Billing] No SMS records found for facility ${facilityId}`,
        );
      } else {
        console.error(
          `[SMS Billing] Error fetching SMS data for facility ${facilityId}:`,
          error.message,
        );
      }
      return null;
    }
  }

  /**
   * Get facility meter data from external APIs
   */
  async getFacilityMeterData(facilityId) {
    try {
      let powerMeters = 0;
      let waterMeters = 0;

      // Get power meters count from API
      try {
        const powerMeterUrl = `${POWER_METERS_API_URL}/${facilityId}`;
        console.log(
          `[Invoice Generator] Calling power meter API: ${powerMeterUrl}`,
        );

        const powerMeterResponse = await axios.get(powerMeterUrl, {
          timeout: 10000, // 10 second timeout
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "PayServe-InvoiceGenerator/1.0",
          },
        });

        console.log(
          `[Invoice Generator] Power meter API response status: ${powerMeterResponse.status}`,
        );
        console.log(
          `[Invoice Generator] Power meter API response data:`,
          powerMeterResponse.data,
        );

        // Updated to match the new API response structure
        if (
          powerMeterResponse.data &&
          powerMeterResponse.data.data &&
          powerMeterResponse.data.data.totalInstalledPowerMeters
        ) {
          powerMeters = powerMeterResponse.data.data.totalInstalledPowerMeters;
        }

        console.log(
          `[Invoice Generator] Power meters for facility ${facilityId}: ${powerMeters}`,
        );
      } catch (error) {
        console.error("Error getting power meter data from API:");
        console.error(`  URL: ${POWER_METERS_API_URL}/${facilityId}`);
        console.error(`  Error message: ${error.message}`);
        console.error(`  Status code: ${error.response?.status || "N/A"}`);
        console.error(`  Response data:`, error.response?.data || "N/A");
      }

      // Get water meters count from API
      try {
        const waterMeterUrl = `${WATER_METERS_API_URL}/${facilityId}`;
        console.log(
          `[Invoice Generator] Calling water meter API: ${waterMeterUrl}`,
        );

        const waterMeterResponse = await axios.get(waterMeterUrl, {
          timeout: 10000, // 10 second timeout
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "PayServe-InvoiceGenerator/1.0",
          },
        });

        console.log(
          `[Invoice Generator] Water meter API response status: ${waterMeterResponse.status}`,
        );
        console.log(
          `[Invoice Generator] Water meter API response data:`,
          waterMeterResponse.data,
        );

        if (
          waterMeterResponse.data &&
          waterMeterResponse.data.totalInstalledWaterMeters
        ) {
          waterMeters = waterMeterResponse.data.totalInstalledWaterMeters;
        }

        console.log(
          `[Invoice Generator] Water meters for facility ${facilityId}: ${waterMeters}`,
        );
      } catch (error) {
        console.error("Error getting water meter data from API:");
        console.error(`  URL: ${WATER_METERS_API_URL}/${facilityId}`);
        console.error(`  Error message: ${error.message}`);
        console.error(`  Status code: ${error.response?.status || "N/A"}`);
        console.error(`  Response data:`, error.response?.data || "N/A");
      }

      return {
        powerMeters: powerMeters || 0,
        waterMeters: waterMeters || 0,
      };
    } catch (error) {
      console.warn("Error getting meter data:", error.message);
      return {
        powerMeters: 0,
        waterMeters: 0,
      };
    }
  }

  /**
   * Generate unique invoice number
   * @param {String} invoiceMonth - Month in YYYY-MM format
   */
  async generateInvoiceNumber(facilityId, invoiceMonth = null) {
    const prefix = "INV";

    let year, month;
    if (invoiceMonth) {
      [year, month] = invoiceMonth.split("-");
    } else {
      year = new Date().getFullYear();
      month = String(new Date().getMonth() + 1).padStart(2, "0");
    }

    // Count existing invoices for this month
    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const count = await payservedb.FacilityInvoice.countDocuments({
      facilityId: new mongoose.Types.ObjectId(facilityId),
      invoiceDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    });

    const sequence = String(count + 1).padStart(4, "0");
    return `${prefix}-${year}${month}-${sequence}`;
  }

  /**
   * Get current month in YYYY-MM format
   */
  getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  /**
   * Check if invoice already exists for facility, recipient, and month
   */
  async checkDuplicateInvoice(facilityId, recipientId, month) {
    const [year, monthNum] = month.split("-");
    const startOfMonth = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endOfMonth = new Date(
      parseInt(year),
      parseInt(monthNum),
      0,
      23,
      59,
      59,
    );

    const recipient = await payservedb.Recipient.findById(recipientId);
    if (!recipient) {
      return null;
    }

    const existing = await payservedb.FacilityInvoice.findOne({
      facilityId: new mongoose.Types.ObjectId(facilityId),
      "recipient.email": recipient.email,
      invoiceDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    });

    return existing;
  }

  /**
   * Start the cron job
   */
  startCron(cronExpression = "0 0 1 * *") {
    // Default: 1st day of every month at midnight
    if (this.cronJob) {
      console.log("Cron job is already running");
      return;
    }

    this.cronJob = cron.schedule(
      cronExpression,
      async () => {
        console.log("Invoice generation cron job triggered");
        if (!this.isRunning) {
          try {
            await this.generateInvoices();
          } catch (error) {
            console.error("Cron job failed:", error);
          }
        } else {
          console.log("Invoice generation already in progress, skipping...");
        }
      },
      {
        scheduled: true,
        timezone: "Africa/Nairobi", // Adjust timezone as needed
      },
    );

    console.log(
      `Invoice generation cron job started with expression: ${cronExpression}`,
    );
  }

  /**
   * Stop the cron job
   */
  stopCron() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("Invoice generation cron job stopped");
    }
  }

  /**
   * Get cron job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cronActive: this.cronJob !== null,
    };
  }
}

// Create a singleton instance
const invoiceGenerator = new InvoiceGenerator();

module.exports = invoiceGenerator;
