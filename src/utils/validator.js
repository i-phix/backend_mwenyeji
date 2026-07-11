const Joi = require("joi");

const loginValidator = Joi.object({
  userName: Joi.string()
    .required()
    .messages({
      "any.required": "Email or phone number is required.",
    })
    .custom((value, helpers) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[0-9]{10}$/; // Adjust based on your phone format

      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        return helpers.message("Please enter a valid email or phone number.");
      }

      return value;
    }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),
});

const loginValidator2 = Joi.object({
  userName: Joi.string()
    .required()
    .messages({
      "any.required": "Email or phone number is required.",
    })
    .custom((value, helpers) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[0-9]{10}$/; // Adjust based on your phone format

      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        return helpers.message("Please enter a valid email or phone number.");
      }

      return value;
    }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),
  platform: Joi.string().required(),
});

const forgotPasswordValidator = Joi.object({
  userName: Joi.string()
    .required()
    .messages({
      "any.required": "Email or phone number is required.",
    })
    .custom((value, helpers) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[0-9]{10}$/; // Adjust based on your phone format

      if (!emailRegex.test(value) && !phoneRegex.test(value)) {
        return helpers.message("Please enter a valid email or phone number.");
      }

      return value;
    }),
});

const resetPasswordValidator = Joi.object({
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),
  confirm_password: Joi.string()
    .min(8)
    .required()
    .valid(Joi.ref("password"))
    .messages({
      "string.min": "Confirm Password must be at least 8 characters long.",
      "any.required": "Confirm Password is required.",
      "any.only": "Confirm Password must match Password.",
    }),
});

const addConcentratorValidator = Joi.object({
  serialNumber: Joi.number().required(),
  manufacturer: Joi.string().required(),
  range: Joi.number().required(),
});

const addPowerGatewayValidator = Joi.object({
  serialNumber: Joi.number().required(),
  manufacturer: Joi.string().required(),
});

const updateConcentratorValidator = Joi.object({
  serialNumber: Joi.number().required(),
  manufacturer: Joi.string().required(),
  range: Joi.number().required(),
});

const updateGatewayValidator = Joi.object({
  serialNumber: Joi.number().required(),
  manufacturer: Joi.string().required(),
});

const updateWaterMeterValidator = Joi.object({
  serialNumber: Joi.number().required(),
  manufacturer: Joi.string().required(),
  size: Joi.string().required(),
  initialValue: Joi.number().required(),
});

const updatePowerMeterValidator = Joi.object({
  serialNumber: Joi.number().required(),
  manufacturer: Joi.string().required(),
  size: Joi.string().required(),
  protocal: Joi.string().required(),
  initialValue: Joi.number().required(),
  currentValue: Joi.number().required(),
});

const geolocationValidator = Joi.object({
  lat: Joi.number().required(),
  long: Joi.string().required(),
});

const inStockValidator = Joi.object({
  inStock: Joi.boolean().required(),
});

const isFaultyValidator = Joi.object({
  isFaulty: Joi.boolean().required(),
});

const isInstalledValidator = Joi.object({
  isFaulty: Joi.boolean().required(),
});

const companyValidator = Joi.object({
  userType: Joi.string().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  idNumber: Joi.string().required(),
  facilityName: Joi.string().required(),
  facilityLocation: Joi.string().required(),
  subDivision: Joi.string().required(),
  divisionArray: Joi.array().required(),
  companyName: Joi.string(),
  companyAddress: Joi.string(),
  companyCountry: Joi.string(),
  companyEmail: Joi.string(),
  companyCity: Joi.string(),
  companyTaxNumber: Joi.string(),
  companyPinNumber: Joi.string(),
  companyRegistrationNumber: Joi.string(),
});

const siteValidator = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().required(),
  country: Joi.string().required(),
});

const AddCompanyUser = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required().messages({
    "string.email": "Please enter a valid email address.",
    "any.required": "Email address is required.",
  }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),
});

const serviceVendorValidator = Joi.object({
  facilityId: Joi.string().required().messages({
    "any.required": "Facility ID is required.",
  }),
  name: Joi.string().required().messages({
    "any.required": "Vendor name is required.",
  }),
  service: Joi.string().required().messages({
    "any.required": "Service is required.",
  }),
  phone: Joi.string()
    .pattern(/^(?:\+254|0)\d{9}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Phone number must start with +254 or 0 followed by 9 digits.",
      "any.required": "Phone number is required.",
    }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address.",
    "any.required": "Email address is required.",
  }),
});

// =====================
// WALLET VALIDATORS
// =====================

// Create wallet validator
const walletValidator = Joi.object({
  facilityId: Joi.string().required(),
  owner: Joi.string().required(),
  ownerType: Joi.string().valid("User", "Customer", "Facility").required(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  amount: Joi.number().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

// Update wallet with transaction validator
const walletUpdateValidator = Joi.object({
  facilityId: Joi.string().required(),
  owner: Joi.string().required(),
  ownerType: Joi.string().valid("User", "Customer", "Facility").required(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  amount: Joi.number().min(0.01).required(),
  transactionType: Joi.string().valid("topup", "deductable").required(),
  description: Joi.string().optional(),
});

// Update wallet balance only validator
const walletBalanceValidator = Joi.object({
  facilityId: Joi.string().required(),
  owner: Joi.string().required(),
  ownerType: Joi.string().valid("User", "Customer", "Facility").required(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  amount: Joi.number().min(0).required(),
});

// Update wallet by ID validator
const walletUpdateByIdValidator = Joi.object({
  amount: Joi.number().min(0).optional(),
  ownerType: Joi.string().valid("User", "Customer", "Facility").optional(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  owner: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
});

// =====================
// TOP-UP VALIDATORS
// =====================

// Create top-up validator
const topUpValidator = Joi.object({
  facilityId: Joi.string().required(),
  walletId: Joi.string().required(),
  amount: Joi.number().min(0.01).required(),
  description: Joi.string().optional(),
  date: Joi.date().optional().default(Date.now),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  // Optional metadata for facility wallets
  metadata: Joi.object({
    invoiceId: Joi.string().required(),
    invoiceNumber: Joi.string().required(),
    amount: Joi.number().min(0.01).required(),
    status: Joi.string().valid("partial", "paid", "cancelled").required(),
    amountToLandlord: Joi.number().min(0).optional().default(0),
    amountToPropertyManager: Joi.number().min(0).optional().default(0),
    paidToLandlord: Joi.boolean().optional().default(false),
    paidToPropertyManager: Joi.boolean().optional().default(false),
    propertyManager: Joi.string().required(),
    landlord: Joi.string().required(),
  }).optional(),
});

// Updated top-up validator with pending metadata support
const topUpValidatorUpdated = Joi.object({
  facilityId: Joi.string().required(),
  walletId: Joi.string().required(),
  amount: Joi.number().min(0.01).required(),
  description: Joi.string().optional(),
  date: Joi.date().optional().default(Date.now),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  // Updated metadata object for pending approval
  metadata: Joi.object({
    invoiceId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required(),
    invoiceNumber: Joi.string().required(),
    amount: Joi.number().min(0.01).required(),
    status: Joi.string()
      .valid("pending", "partial", "paid", "approved", "cancelled")
      .optional()
      .default("pending"),
    amountToLandlord: Joi.number().min(0).optional().default(0),
    amountToPropertyManager: Joi.number().min(0).optional().default(0),
    paidToLandlord: Joi.boolean().optional().default(false),
    paidToPropertyManager: Joi.boolean().optional().default(false),
    propertyManager: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required(),
    landlord: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required(),
    createPending: Joi.boolean().optional().default(false), // Flag to create as pending
  }).optional(),
});

// Update top-up validator
const topUpUpdateValidator = Joi.object({
  facilityId: Joi.string().required(),
  amount: Joi.number().min(0.01).optional(),
  description: Joi.string().optional(),
  date: Joi.date().optional(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  // Optional metadata for facility wallets
  metadata: Joi.object({
    invoiceId: Joi.string().required(),
    invoiceNumber: Joi.string().required(),
    amount: Joi.number().min(0.01).required(),
    status: Joi.string().valid("partial", "paid", "cancelled").required(),
    amountToLandlord: Joi.number().min(0).optional().default(0),
    amountToPropertyManager: Joi.number().min(0).optional().default(0),
    paidToLandlord: Joi.boolean().optional().default(false),
    paidToPropertyManager: Joi.boolean().optional().default(false),
    propertyManager: Joi.string().required(),
    landlord: Joi.string().required(),
  }).optional(),
});

// =====================
// DEDUCTABLE VALIDATORS
// =====================

// Create deductable validator
const deductValidator = Joi.object({
  facilityId: Joi.string().required(),
  walletId: Joi.string().required(),
  amount: Joi.number().min(0.01).required(),
  description: Joi.string().optional(),
  date: Joi.date().optional().default(Date.now),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
});

// Update deductable validator
const deductableUpdateValidator = Joi.object({
  facilityId: Joi.string().required(),
  amount: Joi.number().min(0.01).optional(),
  description: Joi.string().optional(),
  date: Joi.date().optional(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
});

// =====================
// QUERY VALIDATORS
// =====================

// Pagination validator
const paginationValidator = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  includeInactive: Joi.boolean().default(false),
});

// Transaction type filter validator
const transactionFilterValidator = Joi.object({
  transactionType: Joi.string().valid("topup", "deductable").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

// Wallet search validator
const walletSearchValidator = Joi.object({
  ownerType: Joi.string().valid("User", "Customer", "Facility").optional(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  isActive: Joi.boolean().optional(),
  minAmount: Joi.number().min(0).optional(),
  maxAmount: Joi.number().min(0).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

// =====================
// TRANSFER VALIDATOR
// =====================

// Transfer money between wallets validator
const transferValidator = Joi.object({
  facilityId: Joi.string().required(),
  fromOwner: Joi.string().required(),
  fromOwnerType: Joi.string().valid("User", "Customer", "Facility").required(),
  fromWalletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  toOwner: Joi.string().required(),
  toOwnerType: Joi.string().valid("User", "Customer", "Facility").required(),
  toWalletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  amount: Joi.number().min(0.01).required(),
  description: Joi.string().optional(),
});

// =====================
// BULK OPERATIONS VALIDATORS
// =====================

// Bulk wallet creation validator
const bulkWalletValidator = Joi.object({
  facilityId: Joi.string().required(),
  wallets: Joi.array()
    .items(
      Joi.object({
        owner: Joi.string().required(),
        ownerType: Joi.string()
          .valid("User", "Customer", "Facility")
          .required(),
        walletType: Joi.string()
          .valid("levy", "propertyManagement", "lease", "utility", "vas")
          .optional(),
        amount: Joi.number().min(0).default(0),
      }),
    )
    .min(1)
    .max(50)
    .required(),
});

// Bulk status update validator
const bulkStatusUpdateValidator = Joi.object({
  facilityId: Joi.string().required(),
  walletIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
  isActive: Joi.boolean().required(),
});

// =====================
// REPORTING VALIDATORS
// =====================

// Wallet summary report validator
const walletSummaryValidator = Joi.object({
  facilityId: Joi.string().required(),
  ownerType: Joi.string().valid("User", "Customer", "Facility").optional(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  groupBy: Joi.string().valid("day", "week", "month").default("day"),
});

// Transaction report validator
const transactionReportValidator = Joi.object({
  facilityId: Joi.string().required(),
  walletId: Joi.string().optional(),
  ownerType: Joi.string().valid("User", "Customer", "Facility").optional(),
  walletType: Joi.string()
    .valid("levy", "propertyManagement", "lease", "utility", "vas")
    .optional(),
  transactionType: Joi.string().valid("topup", "deductable").optional(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(100),
});

// =====================
// METADATA APPROVAL VALIDATORS
// =====================

// Validator for approving single metadata
const approveMetadataValidator = Joi.object({
  approvedBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid approvedBy user ID format",
      "string.empty": "approvedBy is required",
      "any.required": "approvedBy is required",
    }),
  notes: Joi.string().optional().allow("").max(500).messages({
    "string.max": "notes cannot exceed 500 characters",
  }),
});

// Validator for approving multiple metadata
const approveMultipleMetadataValidator = Joi.object({
  metadataIds: Joi.array()
    .items(
      Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid metadata ID format",
        }),
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one metadata ID is required",
      "array.max": "Cannot approve more than 100 metadata records at once",
      "any.required": "metadataIds array is required",
    }),
  approvedBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid approvedBy user ID format",
      "string.empty": "approvedBy is required",
      "any.required": "approvedBy is required",
    }),
  notes: Joi.string().optional().allow("").max(500).messages({
    "string.max": "notes cannot exceed 500 characters",
  }),
});

// Validator for rejecting metadata
const rejectMetadataValidator = Joi.object({
  rejectedBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid rejectedBy user ID format",
      "string.empty": "rejectedBy is required",
      "any.required": "rejectedBy is required",
    }),
  rejectionReason: Joi.string().required().min(1).max(500).messages({
    "string.empty": "rejectionReason is required",
    "string.min": "rejectionReason is required",
    "string.max": "rejectionReason cannot exceed 500 characters",
    "any.required": "rejectionReason is required",
  }),
});

// Validator for creating pending metadata
const pendingMetadataValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  walletId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid walletId format",
      "any.required": "walletId is required",
    }),
  invoiceId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid invoiceId format",
      "string.empty": "invoiceId is required",
      "any.required": "invoiceId is required",
    }),
  invoiceNumber: Joi.string().required().messages({
    "string.empty": "invoiceNumber is required",
    "any.required": "invoiceNumber is required",
  }),
  amount: Joi.number().positive().precision(2).required().messages({
    "number.positive": "amount must be a positive number",
    "number.precision": "amount can have at most 2 decimal places",
    "any.required": "amount is required",
  }),
  amountToLandlord: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .default(0)
    .messages({
      "number.min": "amountToLandlord cannot be negative",
      "number.precision": "amountToLandlord can have at most 2 decimal places",
    }),
  amountToPropertyManager: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .default(0)
    .messages({
      "number.min": "amountToPropertyManager cannot be negative",
      "number.precision":
        "amountToPropertyManager can have at most 2 decimal places",
    }),
  propertyManager: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid propertyManager ID format",
      "any.required": "propertyManager is required",
    }),
  landlord: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid landlord ID format",
      "any.required": "landlord is required",
    }),
  createdBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid createdBy user ID format",
    }),
});

// Validator for getting pending metadata with query params
const pendingMetadataQueryValidator = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1).messages({
    "number.min": "page must be at least 1",
  }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .messages({
      "number.min": "limit must be at least 1",
      "number.max": "limit cannot exceed 100",
    }),
  walletId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid walletId format",
    }),
  sortBy: Joi.string()
    .valid("createdAt", "amount", "status")
    .optional()
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").optional().default("desc"),
});

// Validator for updating metadata status
const updateMetadataStatusValidator = Joi.object({
  status: Joi.string()
    .valid("pending", "partial", "paid", "approved", "rejected", "cancelled")
    .required()
    .messages({
      "any.only":
        "status must be one of: pending, partial, paid, approved, rejected, cancelled",
      "any.required": "status is required",
    }),
  updatedBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid updatedBy user ID format",
      "any.required": "updatedBy is required",
    }),
  notes: Joi.string().optional().allow("").max(500).messages({
    "string.max": "notes cannot exceed 500 characters",
  }),
});

// Validator for metadata summary report
const metadataSummaryValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  status: Joi.array()
    .items(
      Joi.string().valid(
        "pending",
        "partial",
        "paid",
        "approved",
        "rejected",
        "cancelled",
      ),
    )
    .optional(),
  walletId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid walletId format",
    }),
  groupBy: Joi.string()
    .valid("day", "week", "month", "status")
    .optional()
    .default("status"),
});

// Validator for bulk metadata operations
const bulkMetadataActionValidator = Joi.object({
  metadataIds: Joi.array()
    .items(
      Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid metadata ID format",
        }),
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one metadata ID is required",
      "array.max": "Cannot process more than 100 metadata records at once",
      "any.required": "metadataIds array is required",
    }),
  action: Joi.string()
    .valid("approve", "reject", "cancel")
    .required()
    .messages({
      "any.only": "action must be one of: approve, reject, cancel",
      "any.required": "action is required",
    }),
  actionBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid actionBy user ID format",
      "any.required": "actionBy is required",
    }),
  reason: Joi.string().when("action", {
    is: "reject",
    then: Joi.string().required().min(1).max(500).messages({
      "string.empty": "reason is required when rejecting",
      "string.min": "reason is required when rejecting",
      "string.max": "reason cannot exceed 500 characters",
      "any.required": "reason is required when rejecting",
    }),
    otherwise: Joi.string().optional().allow("").max(500),
  }),
  notes: Joi.string().optional().allow("").max(500).messages({
    "string.max": "notes cannot exceed 500 characters",
  }),
});

// Validator for metadata analytics/reporting
const metadataAnalyticsValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  startDate: Joi.date().optional(),
  endDate: Joi.date()
    .optional()
    .when("startDate", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("startDate")).messages({
        "date.min": "endDate must be after startDate",
      }),
    }),
  status: Joi.array()
    .items(
      Joi.string().valid(
        "pending",
        "partial",
        "paid",
        "approved",
        "rejected",
        "cancelled",
      ),
    )
    .optional(),
  walletId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid walletId format",
    }),
  propertyManager: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid propertyManager ID format",
    }),
  landlord: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid landlord ID format",
    }),
  groupBy: Joi.string()
    .valid("day", "week", "month", "status", "propertyManager", "landlord")
    .optional()
    .default("status"),
  includeApprovalMetrics: Joi.boolean().optional().default(true),
});

// Validator for metadata search/filter
const metadataSearchValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  invoiceNumber: Joi.string().optional(),
  status: Joi.array()
    .items(
      Joi.string().valid(
        "pending",
        "partial",
        "paid",
        "approved",
        "rejected",
        "cancelled",
      ),
    )
    .optional(),
  walletId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid walletId format",
    }),
  propertyManager: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid propertyManager ID format",
    }),
  landlord: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid landlord ID format",
    }),
  minAmount: Joi.number().min(0).optional().messages({
    "number.min": "minAmount cannot be negative",
  }),
  maxAmount: Joi.number()
    .min(0)
    .optional()
    .when("minAmount", {
      is: Joi.exist(),
      then: Joi.number().min(Joi.ref("minAmount")).messages({
        "number.min": "maxAmount must be greater than or equal to minAmount",
      }),
    }),
  startDate: Joi.date().optional(),
  endDate: Joi.date()
    .optional()
    .when("startDate", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("startDate")).messages({
        "date.min": "endDate must be after startDate",
      }),
    }),
  approvedBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid approvedBy user ID format",
    }),
  rejectedBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid rejectedBy user ID format",
    }),
  page: Joi.number().integer().min(1).optional().default(1).messages({
    "number.min": "page must be at least 1",
  }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .messages({
      "number.min": "limit must be at least 1",
      "number.max": "limit cannot exceed 100",
    }),
  sortBy: Joi.string()
    .valid(
      "createdAt",
      "amount",
      "status",
      "approvedAt",
      "rejectedAt",
      "invoiceNumber",
    )
    .optional()
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").optional().default("desc"),
});

// Validator for updating metadata details (non-status fields)
const updateMetadataValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  invoiceNumber: Joi.string().optional(),
  amount: Joi.number().positive().precision(2).optional().messages({
    "number.positive": "amount must be a positive number",
    "number.precision": "amount can have at most 2 decimal places",
  }),
  amountToLandlord: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "amountToLandlord cannot be negative",
    "number.precision": "amountToLandlord can have at most 2 decimal places",
  }),
  amountToPropertyManager: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .messages({
      "number.min": "amountToPropertyManager cannot be negative",
      "number.precision":
        "amountToPropertyManager can have at most 2 decimal places",
    }),
  propertyManager: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid propertyManager ID format",
    }),
  landlord: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid landlord ID format",
    }),
  updatedBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid updatedBy user ID format",
      "any.required": "updatedBy is required",
    }),
  updateReason: Joi.string().optional().max(500).messages({
    "string.max": "updateReason cannot exceed 500 characters",
  }),
});

// Validator for batch metadata creation
const batchMetadataValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  metadataRecords: Joi.array()
    .items(
      Joi.object({
        walletId: Joi.string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            "string.pattern.base": "Invalid walletId format",
            "any.required": "walletId is required",
          }),
        invoiceId: Joi.string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            "string.pattern.base": "Invalid invoiceId format",
            "any.required": "invoiceId is required",
          }),
        invoiceNumber: Joi.string().required().messages({
          "any.required": "invoiceNumber is required",
        }),
        amount: Joi.number().positive().precision(2).required().messages({
          "number.positive": "amount must be a positive number",
          "number.precision": "amount can have at most 2 decimal places",
          "any.required": "amount is required",
        }),
        amountToLandlord: Joi.number()
          .min(0)
          .precision(2)
          .optional()
          .default(0),
        amountToPropertyManager: Joi.number()
          .min(0)
          .precision(2)
          .optional()
          .default(0),
        propertyManager: Joi.string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            "string.pattern.base": "Invalid propertyManager ID format",
            "any.required": "propertyManager is required",
          }),
        landlord: Joi.string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            "string.pattern.base": "Invalid landlord ID format",
            "any.required": "landlord is required",
          }),
      }),
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one metadata record is required",
      "array.max": "Cannot create more than 100 metadata records at once",
      "any.required": "metadataRecords array is required",
    }),
  createdBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid createdBy user ID format",
      "any.required": "createdBy is required",
    }),
  defaultStatus: Joi.string().valid("pending").optional().default("pending"),
});

// Validator for metadata approval workflow settings
const approvalWorkflowValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  requireApproval: Joi.boolean().required().messages({
    "any.required": "requireApproval is required",
  }),
  autoApproveThreshold: Joi.number().min(0).optional().messages({
    "number.min": "autoApproveThreshold cannot be negative",
  }),
  approverRoles: Joi.array()
    .items(Joi.string().valid("admin", "manager", "supervisor", "finance"))
    .optional(),
  maxBulkApproval: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .messages({
      "number.min": "maxBulkApproval must be at least 1",
      "number.max": "maxBulkApproval cannot exceed 100",
    }),
  requireRejectionReason: Joi.boolean().optional().default(true),
  notificationSettings: Joi.object({
    notifyOnPending: Joi.boolean().optional().default(true),
    notifyOnApproval: Joi.boolean().optional().default(false),
    notifyOnRejection: Joi.boolean().optional().default(true),
    emailNotifications: Joi.boolean().optional().default(true),
    smsNotifications: Joi.boolean().optional().default(false),
  }).optional(),
});

// Validator for metadata export/download
const metadataExportValidator = Joi.object({
  facilityId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid facilityId format",
      "any.required": "facilityId is required",
    }),
  format: Joi.string()
    .valid("csv", "excel", "pdf", "json")
    .optional()
    .default("csv"),
  status: Joi.array()
    .items(
      Joi.string().valid(
        "pending",
        "partial",
        "paid",
        "approved",
        "rejected",
        "cancelled",
      ),
    )
    .optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date()
    .optional()
    .when("startDate", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("startDate")).messages({
        "date.min": "endDate must be after startDate",
      }),
    }),
  includeTransactionDetails: Joi.boolean().optional().default(false),
  includeWalletInfo: Joi.boolean().optional().default(true),
  includeApprovalHistory: Joi.boolean().optional().default(true),
  maxRecords: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .optional()
    .default(1000)
    .messages({
      "number.min": "maxRecords must be at least 1",
      "number.max": "maxRecords cannot exceed 10,000",
    }),
});

module.exports = {
  loginValidator,
  loginValidator2,
  forgotPasswordValidator,
  resetPasswordValidator,
  addConcentratorValidator,
  updateConcentratorValidator,
  updateWaterMeterValidator,
  geolocationValidator,
  addPowerGatewayValidator,
  updateGatewayValidator,
  inStockValidator,
  isFaultyValidator,
  isInstalledValidator,
  updatePowerMeterValidator,
  companyValidator,
  AddCompanyUser,
  siteValidator,
  serviceVendorValidator,

  // Wallet validators
  walletValidator,
  walletUpdateValidator,
  walletBalanceValidator,
  walletUpdateByIdValidator,

  // Top-up validators
  topUpValidator,
  topUpValidatorUpdated,
  topUpUpdateValidator,

  // Deductable validators
  deductValidator,
  deductableUpdateValidator,

  // Query validators
  paginationValidator,
  transactionFilterValidator,
  walletSearchValidator,

  // Transfer validator
  transferValidator,

  // Bulk operation validators
  bulkWalletValidator,
  bulkStatusUpdateValidator,

  // Reporting validators
  walletSummaryValidator,
  transactionReportValidator,

  // Metadata approval validators
  approveMetadataValidator,
  approveMultipleMetadataValidator,
  rejectMetadataValidator,
  pendingMetadataValidator,
  pendingMetadataQueryValidator,
  updateMetadataStatusValidator,
  metadataSummaryValidator,
  bulkMetadataActionValidator,
  metadataAnalyticsValidator,
  metadataSearchValidator,
  updateMetadataValidator,
  batchMetadataValidator,
  approvalWorkflowValidator,
  metadataExportValidator,
};
