/**
 * Zoho Books API Configuration
 *
 * Environment Variables Required:
 * - ZOHO_CLIENT_ID
 * - ZOHO_CLIENT_SECRET
 * - ZOHO_ACCESS_TOKEN
 * - ZOHO_REFRESH_TOKEN
 * - ZOHO_ORGANIZATION_ID
 */

require("dotenv").config();

const ZOHO_CONFIG = {
  // OAuth Credentials
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  accessToken: process.env.ZOHO_ACCESS_TOKEN,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,

  // Organization
  organizationId: process.env.ZOHO_ORGANIZATION_ID,

  // API Endpoints
  apiBaseUrl:
    process.env.ZOHO_API_BASE_URL || "https://www.zohoapis.com/books/v3",
  oauthUrl: process.env.ZOHO_OAUTH_URL || "https://accounts.zoho.com/oauth/v2",

  // API Endpoints (constructed)
  endpoints: {
    token: "https://accounts.zoho.com/oauth/v2/token",
    organizations: "https://www.zohoapis.com/books/v3/organizations",
    contacts: "https://www.zohoapis.com/books/v3/contacts",
    invoices: "https://www.zohoapis.com/books/v3/invoices",
    payments: "https://www.zohoapis.com/books/v3/customerpayments",
    items: "https://www.zohoapis.com/books/v3/items",
    currencies: "https://www.zohoapis.com/books/v3/settings/currencies",
  },

  // Token Configuration
  tokenExpiryBuffer: 300, // Refresh token 5 minutes before expiry (in seconds)

  // Request Configuration
  requestTimeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second

  // Invoice Configuration
  defaultCurrency: "KES",
  defaultPaymentTerms: 30, // days
  defaultPaymentTermsLabel: "Net 30",
  allowPartialPayments: true,
  ignoreAutoNumberGeneration: true,

  // Tax Configuration
  taxTreatment: "vat_not_registered", // Kenya default
  isInclusiveTax: false,
  isDiscountBeforeTax: true,

  // Payment Configuration
  defaultPaymentMode: "mpesa",

  // Logging
  enableLogging: process.env.NODE_ENV !== "production",
  logLevel: process.env.ZOHO_LOG_LEVEL || "info",
};

/**
 * Validate configuration
 */
function validateConfig() {
  const requiredFields = [
    "clientId",
    "clientSecret",
    "refreshToken",
    "organizationId",
  ];

  const missing = requiredFields.filter((field) => !ZOHO_CONFIG[field]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Zoho configuration: ${missing.join(", ")}. Provide these via environment variables or call applyRuntimeConfig(...) with facility credentials.`,
    );
  }

  return true;
}

/**
 * Get configuration with validation
 */
function getConfig() {
  validateConfig();
  return ZOHO_CONFIG;
}

/**
 * Update access token in memory
 */
function updateAccessToken(newToken) {
  ZOHO_CONFIG.accessToken = newToken;
  if (ZOHO_CONFIG.enableLogging) {
    console.log("✅ Zoho access token updated");
  }
}

/**
 * Apply facility-scoped runtime configuration
 * Only assigns defined values to override the in-memory config.
 * Useful when credentials are stored per facility in the database.
 * @param {Object} runtime
 * @returns {Object} Updated ZOHO_CONFIG
 */
function applyRuntimeConfig(runtime = {}) {
  const assignIfDefined = (key, val) => {
    if (val !== undefined && val !== null && val !== "") {
      ZOHO_CONFIG[key] = val;
    }
  };

  assignIfDefined("clientId", runtime.clientId);
  assignIfDefined("clientSecret", runtime.clientSecret);
  assignIfDefined("refreshToken", runtime.refreshToken);
  assignIfDefined("accessToken", runtime.accessToken);
  assignIfDefined("organizationId", runtime.organizationId);

  // Optional overrides
  assignIfDefined("apiBaseUrl", runtime.apiBaseUrl);
  assignIfDefined("requestTimeout", runtime.requestTimeout);
  assignIfDefined("maxRetries", runtime.maxRetries);

  return ZOHO_CONFIG;
}

module.exports = {
  ZOHO_CONFIG,
  getConfig,
  validateConfig,
  updateAccessToken,
  applyRuntimeConfig,
};
