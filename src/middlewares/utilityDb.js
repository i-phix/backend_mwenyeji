const mongoose = require("mongoose");

// Prefer the full Atlas URI from env, pointed at utility_database;
// fall back to legacy local config
const utilityConnString = (() => {
  if (process.env.MONGODB_URI) {
    const u = new URL(process.env.MONGODB_URI);
    u.pathname = "/utility_database";
    return u.toString();
  }
  return "mongodb://Ps:Letmein987@127.0.0.1:27017/utility_database?authSource=admin";
})();

// Create and cache the connection
let utilityConn;
const getUtilityConnection = async () => {
  if (utilityConn && utilityConn.readyState === 1) {
    return utilityConn;
  }

  try {
    utilityConn = mongoose.createConnection(utilityConnString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    return utilityConn;
  } catch (connError) {
    throw new Error(`Cannot connect to utility database: ${connError.message}`);
  }
};

// Define schemas
const waterMeterSchema = new mongoose.Schema({
    meterType: {
        type: String,
        required: true,
        enum: ['analog', 'smart']
    },
    meterNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    serialNumber: {
        type: String,
        unique: true,
        trim: true,
        index: true
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    facilityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Facility',
    },
    unitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
    },
    manufacturer: {
        type: String,
        required: true,
    },
    protocol: {
        type: String,
        required: true,
    },
    size: {
        type: String,
        required: true,
    },
    initialReading: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    previousReading: {
        type: Number,
        min: 0,
    },
    currentReading: {
        type: Number,
        min: 0,
        default: 0
    },
    lastReadingDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        required: true,
        enum: ['opened', 'closed', 'maintenance', 'faulty'],
        default: 'opened',
    },
    installationStatus: {
        type: String,
        required: true,
        enum: ['installed', 'not installed'],
        default: 'installed',
    },
    customerType: {
        type: String,
        enum: ['postpaid', 'prepaid'],
    },
    isInstalled: {
        type: Boolean,
        default: false
    },
    enforcement: {
        type: Boolean,
        default: false
    },
    concentratorSerialNumber: {
        type: String
    },
    imageUrl: {
        type: String,
        trim: true
    },
    valveType: {
        type: String,
        enum: ['automatic', 'manual'],
        default: 'automatic'
    },
    accountBalance: {
        type: Number,
        default: 0
    },
    negativeBalance: {
        type: Number,
        default: 0
    },

    // --- Meter Classification ---
    meterCategory: {
        type: String,
        required: true,
        enum: ['unit', 'bulk', 'floor'],
        default: 'unit',
        index: true
    },

    // Retained for backward compatibility — mirrors meterCategory === 'bulk'
    bulkMeter: {
        type: Boolean,
        default: false,
        index: true
    },

    // Used when meterCategory === 'bulk'
    bulkMeterDescription: {
        type: String,
        enum: ['City Council Bulk', 'Borehole Bulk', 'Bulk Inlet', 'Bulk Outlet', 'Bulk Borehole Outlet', 'Common Area'],
        trim: true
    },

    // Used when meterCategory === 'floor' — free-text floor label e.g. "Ground Floor", "Floor 3"
    floorDescription: {
        type: String,
        trim: true
    }

},
  {
    timestamps: true,
  },
);

const dailyWaterMeterHistorySchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaterMeter",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    reading: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["opened", "closed", "maintenance", "faulty"],
      default: "opened",
    },
  },
  { timestamps: true },
);

dailyWaterMeterHistorySchema.index({ meterId: 1, date: 1 });

const monthlyWaterMeterHistorySchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaterMeter",
      required: true,
      index: true,
    },
    yearMonth: { type: String, required: true },
    initialReading: { type: Number, required: true, min: 0 },
    finalReading: { type: Number, required: true, min: 0 },
    consumption: {
      type: Number,
      default: function () {
        return this.finalReading - this.initialReading;
      },
    },
  },
  { timestamps: true },
);

monthlyWaterMeterHistorySchema.index({ meterId: 1, yearMonth: 1 });

const singleDayWaterMeterHistorySchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaterMeter",
      required: true,
      index: true,
    },
    date: { type: String, required: true },
    reading: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["opened", "closed", "maintenance", "faulty"],
      default: "opened",
    },
    time: { type: String, required: true },
  },
  { timestamps: true },
);

singleDayWaterMeterHistorySchema.index({ meterId: 1, date: 1 });

const meterLogSchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaterMeter",
      required: true,
      index: true,
    },
    command: { type: String, required: true, trim: true },
    platform: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    actionBy: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const analogBillingSchema = new mongoose.Schema(
  {
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },
    meterNumber: { type: String, required: true },
    accountNumber: { type: String, required: true },
    currentReading: { type: Number, required: true },
    previousReading: { type: Number, required: true },
    yearMonth: { type: String, required: true }, // Expected format: 'YYYY-MM'
    totalUsage: { type: Number, required: true },
    unitName: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    billingType: { type: String, enum: ["postpaid"] },
    status: {
      type: String,
      enum: ["pending", "reviewed", "billed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

analogBillingSchema.index({ meterNumber: 1, yearMonth: 1 }, { unique: true });

const waterMeterSettingsSchema = new mongoose.Schema(
  {
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
      unique: true,
    },
    minAmount: {
      type: Number,
      required: true,
      default: 1,
    },
    maxAmount: {
      type: Number,
      required: true,
      default: 10000,
    },
    lowThreshold: {
      type: Number,
      default: 0,
    },
    highThreshold: {
      type: Number,
      default: 0,
    },
    freeWaterAllowance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      description:
        "Free water allowance in cubic meters (m³) - users won't be billed for consumption up to this amount",
    },
    gracePeriod: {
      type: Number,
      required: true,
      default: 10,
    },
    invoiceDay: {
      type: Number,
      required: true,
      min: 0,
      max: 30,
      default: 3,
    },
    enforcePayment: {
      type: String,
      enum: ["yes", "no"],
      required: true,
      default: "no",
    },
    minimumPaymentAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    tariff: {
      type: String,
      enum: ["yes", "no"],
      required: true,
      default: "no",
    },
    tariffAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    tariffAmountSmart: {
      type: Number,
      default: 0,
    },
    fixedTariffAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    meterLoan: {
      type: Number,
      default: 0,
    },
    standingCharge: {
      type: Number,
      default: 0,
    },

    // Updated notification structure - separated concerns
    notifications: {
      // Usage and billing notifications
      usageAlerts: {
        enabled: {
          type: Boolean,
          default: false,
        },
        daily: {
          type: Boolean,
          default: false,
        },
        weekly: {
          type: Boolean,
          default: false,
        },
        monthly: {
          type: Boolean,
          default: false,
        },
      },
      statements: {
        enabled: {
          type: Boolean,
          default: false,
        },
      },
      // Payment reminder notifications
      paymentReminders: {
        enabled: {
          type: Boolean,
          default: false,
        },
        daysBeforeDue: {
          type: Number,
          default: 3,
          min: 1,
          max: 30,
        },
        frequency: {
          type: String,
          enum: ["daily", "weekly", "once"],
          default: "once",
        },
      },
    },

    // Other charges section
    otherCharges: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
    sewerageCharge: {
      type: Number,
      default: 0,
    },
    fixedCharge: {
      type: Number,
      default: 0,
    },
    vatPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Payment methods
    paymentMethods: {
      mobilePayment: {
        status: {
          type: Boolean,
          default: false,
        },
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FacilityPaymentDetails",
        },
      },
      bankPayment: {
        status: {
          type: Boolean,
          default: false,
        },
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BankDetails",
        },
      },
    },

    // Discounts
    discounts: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          enum: ["percentage", "fixed_amount"],
          required: true,
        },
        value: {
          type: Number,
          required: true,
          min: 0,
        },
        yearMonth: {
          type: String,
          required: true,
        },
      },
    ],
    // Biller address for invoices
    billerAddress: {
      name: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        validate: {
          validator: function (v) {
            if (!v) return true; // allow empty
            return /^\w+([\.-]?\w+)@\w+([\.-]?\w+)(\.\w{2,3})+$/.test(v);
          },
          message: "Please enter a valid email address",
        },
      },
      phone: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
        default: "Kenya",
      },
      digitalSignature: {
        type: String,
        required: false,
      },
    },
    // GL accounts for accounting entries
    glAccounts: {
      invoice: {
        debit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GLAccount",
          required: false,
        },
        credit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GLAccount",
          required: false,
        },
      },
      payment: {
        debit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GLAccount",
          required: false,
        },
        credit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GLAccount",
          required: false,
        },
      },
    },

    //GL ACCOUNT DOUBLE ENTRIES

    invocieCreationDe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GLAccountDoubleEntries",
      unique: true,
    },

    invoicePaymentDe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GLAccountDoubleEntries",
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

const waterInvoiceSchema = new mongoose.Schema(
  {
    // Basic identifiers
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    unitName: {
      type: String,
      required: true,
    },
    yearMonth: {
      type: String,
      required: true,
    },
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    billingType: {
      type: String,
      enum: ["postpaid"],
    },
    balanceBroughtForward: {
      type: Number,
      default: 0,
    },

    // PAYMENTS - Updated structure
    paymentMethods: {
      mobilePayment: {
        status: {
          type: Boolean,
          default: false,
        },
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FacilityPaymentDetails",
        },
      },
      bankPayment: {
        status: {
          type: Boolean,
          default: false,
        },
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BankDetails",
        },
      },
      cashPayment: {
        status: {
          type: Boolean,
          default: false,
        },
      },
    },
    paymentMethod: {
      type: String,
      enum: ["mobile", "bank", "cash", "mixed"],
      default: null,
    },

    // Biller Address Information
    billerAddress: {
      name: {
        type: String,
        required: [true, "Biller name is required"],
        trim: true,
        minlength: [1, "Biller name must be at least 1 character long"],
      },
      email: {
        type: String,
        required: [true, "Biller email is required"],
        trim: true,
        lowercase: true,
        validate: {
          validator: function (v) {
            return /^\w+([\.-]?\w+)@\w+([\.-]?\w+)(\.\w{2,3})+$/.test(v);
          },
          message: "Please enter a valid email address",
        },
      },
      phone: {
        type: String,
        required: [true, "Biller phone is required"],
        trim: true,
      },
      address: {
        type: String,
        required: [true, "Biller address is required"],
        trim: true,
      },
      city: {
        type: String,
        required: [true, "Biller city is required"],
        trim: true,
      },
    },

    // Dates
    dateIssued: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },

    // Meter & Consumption Details
    meterNumber: {
      type: String,
      required: true,
    },
    meterReadings: {
      previousReading: {
        type: Number,
        required: true,
      },
      currentReading: {
        type: Number,
        required: true,
      },
      usage: {
        type: Number,
        required: true,
      },
    },
    consumptionPeriod: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },

    // Charges
    charges: {
      waterCharge: {
        type: Number,
        required: true,
      },
      sewerCharge: {
        type: Number,
        default: 0,
      },
      tax: {
        type: Number,
        default: 0,
      },
      fixedCharge: {
        type: Number,
        default: 0,
      },
      totalMonthlyBill: {
        type: Number,
        required: true,
      },
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    imageUrl: { type: String, trim: true },

    // Invoice Note & Status
    invoiceNote: {
      type: String,
      default: "Payment is due within 10 days",
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Pending",
        "Paid",
        "Partially Paid",
        "Cancelled",
        "Overdue",
        "Unpaid",
      ],
      default: "Unpaid",
    },

    // Currency Info
    currency: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
      },
      name: {
        type: String,
        default: "Kenyan Shilling",
      },
      code: {
        type: String,
        default: "KES",
      },
      symbol: {
        type: String,
        default: "KSh",
      },
    },
    notificationsSent: {
      type: {
        sms: {
          type: Boolean,
          default: false,
        },
        email: {
          type: Boolean,
          default: false,
        },
        sentAt: {
          type: Date,
          default: null,
        },
        lastAttempt: {
          type: Date,
          default: null,
        },
        attempts: {
          type: Number,
          default: 0,
        },
        smsDetails: {
          type: {
            success: Boolean,
            error: String,
            sentAt: Date,
            phoneNumber: String,
          },
          default: null,
        },
        emailDetails: {
          type: {
            success: Boolean,
            error: String,
            sentAt: Date,
            emailAddress: String,
          },
          default: null,
        },
      },
      default: {
        sms: false,
        email: false,
        sentAt: null,
        lastAttempt: null,
        attempts: 0,
        smsDetails: null,
        emailDetails: null,
      },
    },

    // Payment & Reconciliation
    reconciliationHistory: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        amount: {
          type: Number,
          required: true,
        },
        type: {
          type: String,
          default: "Manual",
        },
        paymentReference: {
          type: String,
        },
        paymentCompletion: {
          type: String,
          default: "Completed",
        },
        sourceInvoice: {
          type: String,
        },
        destinationInvoice: {
          type: String,
        },
        notes: {
          type: String,
        },
        remainingBalance: {
          type: Number,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const waterMeterAccountSchema = new mongoose.Schema(
  {
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },
    account_no: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    meterNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
    },
    unitName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    payment_type: {
      type: String,
      required: true,
      enum: ["Postpaid", "Prepaid"],
    },
    previousReading: {
      type: Number,
      required: true,
      default: 0,
    },
    currentReading: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    created_on: {
      type: Date,
      required: true,
      default: Date.now,
    },
    meter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaterMeter",
    },
    accountBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const waterPrepaidCreditSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaterMeterAccount",
      required: true,
    },
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaterMeter",
      required: true,
    },
    ref: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    time: {
      type: String,
      required: true,
    },
    addedOn: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Mobile Money", "Bank", "Manual"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Store models
const models = {};

// Function to get a model
const getModel = async (modelName) => {
  if (models[modelName]) return models[modelName];

  const conn = await getUtilityConnection();

  switch (modelName) {
    case "WaterMeter":
      models[modelName] =
        conn.models.WaterMeter || conn.model("WaterMeter", waterMeterSchema);
      break;
    case "DailyWaterMeterHistory":
      models[modelName] =
        conn.models.DailyWaterMeterHistory ||
        conn.model("DailyWaterMeterHistory", dailyWaterMeterHistorySchema);
      break;
    case "MonthlyWaterMeterHistory":
      models[modelName] =
        conn.models.MonthlyWaterMeterHistory ||
        conn.model("MonthlyWaterMeterHistory", monthlyWaterMeterHistorySchema);
      break;
    case "SingleDayWaterMeterHistory":
      models[modelName] =
        conn.models.SingleDayWaterMeterHistory ||
        conn.model(
          "SingleDayWaterMeterHistory",
          singleDayWaterMeterHistorySchema,
        );
      break;
    case "MeterLog":
      models[modelName] =
        conn.models.MeterLog || conn.model("MeterLog", meterLogSchema);
      break;
    case "AnalogBilling":
      models[modelName] =
        conn.models.AnalogBilling ||
        conn.model("AnalogBilling", analogBillingSchema);
      break;
    case "WaterMeterSettings":
      models[modelName] =
        conn.models.WaterMeterSettings ||
        conn.model("WaterMeterSettings", waterMeterSettingsSchema);
      break;
    case "WaterInvoice":
      models[modelName] =
        conn.models.WaterInvoice ||
        conn.model("WaterInvoice", waterInvoiceSchema);
      break;
    case "WaterMeterAccount":
      models[modelName] =
        conn.models.WaterMeterAccount ||
        conn.model("WaterMeterAccount", waterMeterAccountSchema);
      break;
    case "WaterPrepaidCredit":
      models[modelName] =
        conn.models.WaterPrepaidCredit ||
        conn.model("WaterPrepaidCredit", waterPrepaidCreditSchema);
      break;
    default:
      throw new Error(`Model ${modelName} not defined`);
  }

  return models[modelName];
};

module.exports = {
  getUtilityConnection,
  getModel,
};
