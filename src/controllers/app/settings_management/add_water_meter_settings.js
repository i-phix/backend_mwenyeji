const utilityDb = require("../../../middlewares/utilityDb");
const { getModel } = require("../../../utils/getModel");
const payservedb = require("payservedb");

const add_water_meter_settings = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const settingsData = request.body;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    const WaterMeterSettingsModel =
      await utilityDb.getModel("WaterMeterSettings");

    // Check if settings already exist
    const existingSettings = await WaterMeterSettingsModel.findOne({
      facilityId,
    });
    if (existingSettings) {
      return reply.code(409).send({
        success: false,
        error:
          "Water meter settings already exist for this facility. Use update instead.",
      });
    }

    let invoiceCreationDeId = null;
    let invoicePaymentDeId = null;

    // Create Double Entry for Invoice Creation if GL accounts are provided
    if (
      settingsData.glAccounts?.invoice?.debit &&
      settingsData.glAccounts?.invoice?.credit
    ) {
      try {
        const glAccountDoubleEntriesModel = await getModel(
          "GLAccountDoubleEntries",
          payservedb.GLAccountDoubleEntries.schema,
          facilityId,
        );

        const invoiceDoubleEntry = await glAccountDoubleEntriesModel.create({
          accountdebited: settingsData.glAccounts.invoice.debit,
          accountcredited: settingsData.glAccounts.invoice.credit,
          facilityId,
          createdAt: new Date(),
        });

        invoiceCreationDeId = invoiceDoubleEntry._id;
        console.log(
          "Invoice creation double entry created:",
          invoiceCreationDeId,
        );
      } catch (error) {
        console.error("Error creating invoice double entry:", error);
        return reply.code(400).send({
          success: false,
          error: "Failed to create invoice GL double entry",
          details: error.message,
        });
      }
    }

    // Create Double Entry for Invoice Payment if GL accounts are provided
    if (
      settingsData.glAccounts?.payment?.debit &&
      settingsData.glAccounts?.payment?.credit
    ) {
      try {
        const glAccountDoubleEntriesModel = await getModel(
          "GLAccountDoubleEntries",
          payservedb.GLAccountDoubleEntries.schema,
          facilityId,
        );

        const paymentDoubleEntry = await glAccountDoubleEntriesModel.create({
          accountdebited: settingsData.glAccounts.payment.debit,
          accountcredited: settingsData.glAccounts.payment.credit,
          facilityId,
          createdAt: new Date(),
        });

        invoicePaymentDeId = paymentDoubleEntry._id;
        console.log(
          "Invoice payment double entry created:",
          invoicePaymentDeId,
        );
      } catch (error) {
        console.error("Error creating payment double entry:", error);
        return reply.code(400).send({
          success: false,
          error: "Failed to create payment GL double entry",
          details: error.message,
        });
      }
    }

    // Prepare data with defaults
    const newSettings = {
      facilityId,
      minAmount: settingsData.minAmount || 1,
      maxAmount: settingsData.maxAmount || 10000,
      lowThreshold: settingsData.lowThreshold || 0,
      highThreshold: settingsData.highThreshold || 0,
      freeWaterAllowance: settingsData.freeWaterAllowance || 0,
      gracePeriod: settingsData.gracePeriod || 10,
      invoiceDay: settingsData.invoiceDay || 3,
      enforcePayment: settingsData.enforcePayment || "no",
      minimumPaymentAmount: settingsData.minimumPaymentAmount || 0,
      tariff: settingsData.tariff || "no",
      tariffAmount: settingsData.tariffAmount || 0,
      tariffAmountSmart: settingsData.tariffAmountSmart || 0,
      fixedTariffAmount: settingsData.fixedTariffAmount || 0,
      meterLoan: settingsData.meterLoan || 0,
      standingCharge: settingsData.standingCharge || 0,
      otherCharges: settingsData.otherCharges || "no",
      sewerageCharge: settingsData.sewerageCharge || 0,
      fixedCharge: settingsData.fixedCharge || 0,
      vatPercentage: settingsData.vatPercentage || 0,

      // Updated notifications structure matching the schema
      notifications: {
        usageAlerts: {
          enabled: settingsData.notifications?.usageAlerts?.enabled || false,
          daily: settingsData.notifications?.usageAlerts?.daily || false,
          weekly: settingsData.notifications?.usageAlerts?.weekly || false,
          monthly: settingsData.notifications?.usageAlerts?.monthly || false,
        },
        statements: {
          enabled: settingsData.notifications?.statements?.enabled || false,
        },
        paymentReminders: {
          enabled:
            settingsData.notifications?.paymentReminders?.enabled || false,
          daysBeforeDue:
            settingsData.notifications?.paymentReminders?.daysBeforeDue || 3,
          frequency:
            settingsData.notifications?.paymentReminders?.frequency || "once",
        },
      },

      // Payment methods configuration
      paymentMethods: {
        mobilePayment: {
          status: settingsData.paymentMethods?.mobilePayment?.status || false,
          paymentId:
            settingsData.paymentMethods?.mobilePayment?.paymentId || null,
        },
        bankPayment: {
          status: settingsData.paymentMethods?.bankPayment?.status || false,
          paymentId:
            settingsData.paymentMethods?.bankPayment?.paymentId || null,
        },
      },

      // Store the double entry IDs
      invocieCreationDe: invoiceCreationDeId, 
      invoicePaymentDe: invoicePaymentDeId
    };

    // Add biller address if provided
    if (settingsData.billerAddress) {
      newSettings.billerAddress = {
        name: settingsData.billerAddress.name?.trim() || "",
        email: settingsData.billerAddress.email?.toLowerCase().trim() || "",
        phone: settingsData.billerAddress.phone?.trim() || "",
        address: settingsData.billerAddress.address?.trim() || "",
        city: settingsData.billerAddress.city?.trim() || "",
      };
    }

    // Add GL accounts if provided (keeping original structure for reference)
    if (settingsData.glAccounts) {
      newSettings.glAccounts = {
        invoice: {
          debit: settingsData.glAccounts.invoice?.debit || null,
          credit: settingsData.glAccounts.invoice?.credit || null,
        },
        payment: {
          debit: settingsData.glAccounts.payment?.debit || null,
          credit: settingsData.glAccounts.payment?.credit || null,
        },
      };
    }

    // Add discounts if provided
    if (settingsData.discounts && Array.isArray(settingsData.discounts)) {
      newSettings.discounts = settingsData.discounts;
    }

    const settings = new WaterMeterSettingsModel(newSettings);
    await settings.save();

    console.log(
      "Water meter settings created successfully for facility:",
      facilityId,
    );

    return reply.code(201).send({
      success: true,
      message: "Water meter settings created successfully",
      data: settings,
      doubleEntries: {
        invoiceCreation: invoiceCreationDeId,
        invoicePayment: invoicePaymentDeId,
      },
    });
  } catch (err) {
    console.error("Error in add_water_meter_settings:", err);

    if (err.name === "ValidationError") {
      const validationErrors = Object.values(err.errors).map(
        (error) => error.message,
      );
      return reply.code(400).send({
        success: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    if (err.code === 11000) {
      return reply.code(409).send({
        success: false,
        error: "Water meter settings already exist for this facility",
      });
    }

    return reply.code(500).send({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Contact system administrator",
    });
  }
};

module.exports = add_water_meter_settings;
