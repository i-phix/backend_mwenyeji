const payservedb = require("payservedb");
const utilityDb = require("../../../../middlewares/utilityDb");
const { getModel } = require("../../../../utils/getModel");
const { sendSms } = require("../../../../utils/send_new_sms");
const { sendEmail } = require("../../../../utils/send_new_email");
const { sendUtilityNotification } = require("../../../../utils/send_utility_notification");

/**
 * Creates or updates billing data and generates an invoice for a single meter
 */
const generateMeterBill = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { meterNumber, yearMonth, meterReading } = request.body;

    // Validate required fields
    if (!meterNumber || !yearMonth || meterReading === undefined) {
      return reply.code(400).send({
        success: false,
        error:
          "Missing required fields: meterNumber, yearMonth, and meterReading are required",
      });
    }

    // Validate year_month format (YYYY-MM)
    const yearMonthRegex = /^\d{4}-\d{2}$/;
    if (!yearMonthRegex.test(yearMonth)) {
      return reply.code(400).send({
        success: false,
        error: "Invalid yearMonth format. Use YYYY-MM",
      });
    }

    // Get required models from utility database
    const analogMeterModel = await utilityDb.getModel("WaterMeter");
    const analogBillingModel = await utilityDb.getModel("AnalogBilling");
    const waterMeterSettingsModel =
      await utilityDb.getModel("WaterMeterSettings");
    const waterInvoiceModel = await utilityDb.getModel("WaterInvoice");

    // Find the meter in utility database
    const meter = await analogMeterModel.findOne({ meterNumber, facilityId });
    if (!meter) {
      return reply.code(404).send({
        success: false,
        error: `Meter with meterNumber ${meterNumber} not found`,
      });
    }

    // Convert meter reading to number
    const currentReading = parseFloat(meterReading);
    if (isNaN(currentReading)) {
      return reply.code(400).send({
        success: false,
        error: "Invalid meter reading value",
      });
    }

    // Get previous reading value
    const previousReading = meter.previousReading || meter.initialReading || 0;

    // Validate that current reading is not less than previous reading
    if (currentReading < previousReading) {
      return reply.code(400).send({
        success: false,
        error: `Current reading (${currentReading}) cannot be less than previous reading (${previousReading})`,
      });
    }

    // Get unit info from payservedb (assuming units are still in payservedb)
    let unitName = "Unknown";
    if (meter.unitId) {
      const unitModel = await getModel(
        "Unit",
        payservedb.Unit.schema,
        facilityId,
      );
      const unit = await unitModel.findById(meter.unitId);
      if (unit && unit.name) {
        unitName = unit.name;
      }
    }

    const customerId = meter.customerId;
    const billingType = meter.customerType;
    const accountNumber = meter.accountNumber;
    // Extract imageUrl from meter (this is the key addition)
    const meterImageUrl = meter.imageUrl || null;

    // Calculate total usage and round to 2 decimal places
    const totalUsage = parseFloat(
      (currentReading - previousReading).toFixed(2),
    );

    // Check if a reading for this meter and month already exists
    const existingReading = await analogBillingModel.findOne({
      meterNumber,
      yearMonth,
      facilityId,
    });

    let billing;
    let updateMessage = "";
    let isUpdate = false;

    if (existingReading) {
      // Update existing billing record instead of returning error
      updateMessage = `Updated existing billing record for meter ${meterNumber} in ${yearMonth}`;
      isUpdate = true;

      billing = await analogBillingModel.findOneAndUpdate(
        { _id: existingReading._id },
        {
          currentReading,
          previousReading,
          totalUsage,
          unitName,
          status: "reviewed", // Set to reviewed to allow immediate invoice generation
        },
        { new: true }, // Return the updated document
      );
    } else {
      // Create new billing record
      billing = await analogBillingModel.create({
        facilityId,
        meterNumber,
        accountNumber,
        currentReading,
        previousReading,
        yearMonth,
        totalUsage,
        unitName,
        customerId,
        billingType,
        status: "reviewed", // Set to reviewed to allow immediate invoice generation
      });
    }

    const currentDate = new Date();

    // Update the meter with reading history
    await analogMeterModel.findByIdAndUpdate(meter._id, {
      previousReading: previousReading,
      currentReading: currentReading,
      lastReadingDate: currentDate,
      $push: {
        readingHistory: {
          previousReading: previousReading,
          currentReading: currentReading,
          readingDate: currentDate,
          readBy: "Property Manager",
          consumption: totalUsage,
        },
      },
    });

    // Get meter settings from utility database
    const meterSettings = await waterMeterSettingsModel.findOne({ facilityId });
    if (!meterSettings) {
      return reply.code(200).send({
        success: true,
        message: isUpdate
          ? `${updateMessage}, but invoice generation failed: No meter settings found`
          : "Billing created successfully, but invoice generation failed: No meter settings found",
        billing,
        invoice: null,
      });
    }

    // Get previous invoice for this period to determine consumption period
    const existingInvoice = await waterInvoiceModel
      .findOne({
        meterNumber,
        yearMonth,
        facilityId,
      })
      .sort({ createdAt: -1 });

    // Get consumption period based on existing invoices or previous billing
    const consumptionPeriod = await getConsumptionPeriodForNewInvoice(
      facilityId,
      meterNumber,
      yearMonth,
      existingInvoice,
    );

    // Always generate a new invoice (don't update existing) - Pass meterImageUrl
    const invoice = await generateWaterInvoice(
      facilityId,
      billing,
      meterSettings,
      consumptionPeriod,
      meterImageUrl, // Pass the meter's imageUrl
    );

    // Update billing status to 'billed'
    await analogBillingModel.updateOne(
      { _id: billing._id },
      { status: "billed" },
    );

    // Send notification if enabled
    if (meterSettings.notifications && customerId) {
      await sendInvoiceNotification(customerId, invoice, facilityId);
    }

    return reply.code(200).send({
      success: true,
      message: isUpdate
        ? `${updateMessage} and new invoice generated successfully`
        : "Billing and invoice generated successfully",
      billing,
      invoice,
    });
  } catch (err) {
    console.error("Error in generateMeterBill:", err);
    return reply.code(500).send({
      success: false,
      error: err.message,
    });
  }
};

// Helper function to generate a unique invoice number
async function generateInvoiceNumber() {
  const randomNumber = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `WTR-${randomNumber}`;
}

// Helper function to calculate due date
function calculateDueDate(gracePeriod) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + gracePeriod);
  return dueDate;
}

// Helper function to get consumption period specifically for new invoices
async function getConsumptionPeriodForNewInvoice(
  facilityId,
  meterNumber,
  yearMonth,
  existingInvoice,
) {
  try {
    let startDate;
    const endDate = new Date(); // Current date as end date

    if (existingInvoice) {
      // If there's an existing invoice for this period, use its last billing date as start
      startDate = existingInvoice.createdAt;
    } else {
      // Find most recent invoice for this meter from utility database
      const waterInvoiceModel = await utilityDb.getModel("WaterInvoice");
      const lastInvoice = await waterInvoiceModel
        .findOne({
          meterNumber,
          facilityId,
        })
        .sort({ createdAt: -1 });

      if (lastInvoice) {
        // Use last invoice's billing date as start date
        startDate = lastInvoice.createdAt;
      } else {
        // Fall back to standard consumption period logic
        startDate = await getStandardConsumptionStartDate(
          facilityId,
          meterNumber,
          yearMonth,
        );
      }
    }

    return { startDate, endDate };
  } catch (error) {
    console.error(
      `Error getting consumption period for new invoice: ${error.message}`,
    );
    // Fallback to current month
    const date = new Date();
    return {
      startDate: new Date(date.getFullYear(), date.getMonth(), 1),
      endDate: new Date(),
    };
  }
}

// Helper function to get standard consumption start date
async function getStandardConsumptionStartDate(
  facilityId,
  meterNumber,
  yearMonth,
) {
  try {
    // Parse the current billing year-month
    const [year, month] = yearMonth.split("-").map((num) => parseInt(num));

    // Get previous month's billing in YYYY-MM format
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const analogBillingModel = await utilityDb.getModel("AnalogBilling");

    const previousBilling = await analogBillingModel
      .findOne({
        facilityId,
        meterNumber,
        yearMonth: prevYearMonth,
      })
      .sort({ createdAt: -1 });

    if (previousBilling) {
      // If there's a previous billing, use its creation date
      return new Date(previousBilling.createdAt);
    } else {
      // Check the meter's last reading date from utility database
      const analogMeterModel = await utilityDb.getModel("WaterMeter");

      const meterInfo = await analogMeterModel.findOne({
        meterNumber,
        facilityId,
      });

      if (meterInfo && meterInfo.lastReadingDate) {
        return new Date(meterInfo.lastReadingDate);
      } else {
        // Default to first day of previous month
        return new Date(prevYear, prevMonth - 1, 1);
      }
    }
  } catch (error) {
    console.error(
      `Error getting standard consumption start date: ${error.message}`,
    );
    // Default to first day of current month
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
}

// Helper function to create water invoice
async function generateWaterInvoice(
  facilityId,
  billing,
  meterSettings,
  consumptionPeriod = null,
  meterImageUrl = null,
) {
  try {
    const waterInvoiceModel = await utilityDb.getModel("WaterInvoice");

    // Calculate charges separately for transparency
    let variableWaterCharge = 0;
    let fixedCharge = 0;

    if (meterSettings.tariff === "yes") {
      // Variable charge based on usage
      variableWaterCharge = billing.totalUsage * meterSettings.tariffAmount;
      // Fixed monthly charge
      fixedCharge = meterSettings.fixedTariffAmount;
    } else {
      // If no tariff, treat as fixed charge only
      fixedCharge = meterSettings.fixedTariffAmount;
    }

    // Total water charge is the sum of variable and fixed charges
    const totalWaterCharge = variableWaterCharge + fixedCharge;

    const invoiceNumber = await generateInvoiceNumber();
    const dueDate = calculateDueDate(meterSettings.gracePeriod);

    // Use provided consumption period or generate one
    const usedConsumptionPeriod =
      consumptionPeriod ||
      (await getConsumptionPeriodForNewInvoice(
        facilityId,
        billing.meterNumber,
        billing.yearMonth,
      ));

    const waterInvoice = await waterInvoiceModel.create({
      invoiceNumber,
      accountNumber: billing.accountNumber,
      facilityId,
      unitName: billing.unitName,
      customerId: billing.customerId,
      yearMonth: billing.yearMonth,
      dueDate,
      meterNumber: billing.meterNumber,
      billingType: billing.billingType,
      billerAddress: meterSettings.billerAddress, // Added billerAddress from meterSettings
      imageUrl: meterImageUrl, // Include the meter's imageUrl in the invoice
      meterReadings: {
        previousReading: billing.previousReading,
        currentReading: billing.currentReading,
        usage: billing.totalUsage,
      },
      consumptionPeriod: usedConsumptionPeriod,
      charges: {
        waterCharge: variableWaterCharge,
        fixedCharge: fixedCharge,
        sewerCharge: 0,
        tax: 0,
        totalMonthlyBill: totalWaterCharge,
      },
      status: "Unpaid",
    });

    return waterInvoice;
  } catch (error) {
    console.error(`Error creating water invoice: ${error.message}`);
    throw error;
  }
}

// Helper function to send invoice notification
async function sendInvoiceNotification(customerId, invoice, facilityId) {
  try {
    // Customer data is still in payservedb
    const customerModel = await getModel(
      "Customer",
      payservedb.Customer.schema,
      facilityId,
    );
    const customer = await customerModel.findOne({ _id: customerId });

    if (!customer) {
      console.log(`Customer ${customerId} not found`);
      return;
    }

    const message = `Dear ${customer.firstName}, your water bill of ${invoice.charges.totalMonthlyBill} ${invoice.currency?.symbol || ""} is ready. Invoice #${invoice.invoiceNumber} due by ${new Date(invoice.dueDate).toLocaleDateString()}. Thank you.`;

    const results = {
      sms: { success: false, error: null },
      email: { success: false, error: null },
    };

    // Send SMS if customer has phone number
    if (customer.phoneNumber) {
      try {
        const smsResponse = await sendUtilityNotification(facilityId, customer.phoneNumber, message, {
          contactName: customer.customerName || customer.firstName,
          source: 'water-bill-ready'
        });
        console.log("SMS Response:", smsResponse);

        if (smsResponse && smsResponse.success) {
          results.sms.success = true;
          console.log(`SMS invoice notification sent successfully to ${customer.phoneNumber}`);
        } else {
          results.sms.error = "SMS response indicates failure";
          console.log(`SMS invoice notification may have failed for ${customer.phoneNumber}:`, smsResponse);
        }
      } catch (smsError) {
        results.sms.error = smsError.message;
        console.error(`Error sending SMS invoice notification to ${customer.phoneNumber}: ${smsError.message}`);
      }
    }

    // Send Email if customer has email
    if (customer.email) {
      try {
        const emailResponse = await sendEmail(
          facilityId,
          customer.email,
          "Water Bill Invoice",
          message,
        );

        if (emailResponse && emailResponse.success) {
          results.email.success = true;
          console.log(`Email invoice notification sent successfully to ${customer.email}`);
        } else {
          results.email.error = "Email response indicates failure";
          console.log(`Email invoice notification may have failed for ${customer.email}:`, emailResponse);
        }
      } catch (emailError) {
        results.email.error = emailError.message;
        console.error(`Error sending Email invoice notification to ${customer.email}: ${emailError.message}`);
      }
    }

    // Log overall results
    const sentMethods = [];
    if (results.sms.success) sentMethods.push("SMS");
    if (results.email.success) sentMethods.push("Email");

    if (sentMethods.length > 0) {
      console.log(`Invoice notification sent successfully via: ${sentMethods.join(", ")} for customer ${customerId}`);
    } else {
      console.error(`All invoice notification methods failed for customer ${customerId}. SMS: ${results.sms.error || "not attempted"}, Email: ${results.email.error || "not attempted"}`);
    }
  } catch (error) {
    console.error(`Error sending invoice notification: ${error.message}`);
  }
}

module.exports = generateMeterBill;