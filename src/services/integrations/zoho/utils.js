/**
 * Zoho Books Integration Utility Functions
 * Common helper functions used across the integration
 */

/**
 * Format date to Zoho Books format (YYYY-MM-DD)
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      console.warn(`Invalid date: ${date}`);
      return null;
    }

    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date:', error.message);
    return null;
  }
}

/**
 * Format datetime to ISO string
 * @param {string|Date} datetime - Datetime to format
 * @returns {string} ISO string
 */
function formatDateTime(datetime) {
  if (!datetime) return null;

  try {
    const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;

    if (isNaN(dateObj.getTime())) {
      console.warn(`Invalid datetime: ${datetime}`);
      return null;
    }

    return dateObj.toISOString();
  } catch (error) {
    console.error('Error formatting datetime:', error.message);
    return null;
  }
}

/**
 * Calculate payment terms in days between two dates
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Number of days
 */
function calculatePaymentTerms(startDate, endDate) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (error) {
    console.error('Error calculating payment terms:', error.message);
    return 30; // Default
  }
}

/**
 * Format amount to 2 decimal places
 * @param {number} amount - Amount to format
 * @returns {number} Formatted amount
 */
function formatAmount(amount) {
  if (amount === null || amount === undefined) return 0;
  return parseFloat(parseFloat(amount).toFixed(2));
}

/**
 * Format currency display
 * @param {number} amount - Amount
 * @param {string} currencyCode - Currency code
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currencyCode = 'KES') {
  return `${currencyCode} ${formatAmount(amount).toLocaleString()}`;
}

/**
 * Sanitize string for Zoho API
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (!str) return '';
  return str.toString().trim();
}

/**
 * Build full name from first and last name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} Full name
 */
function buildFullName(firstName, lastName) {
  const first = sanitizeString(firstName);
  const last = sanitizeString(lastName);
  return `${first} ${last}`.trim();
}

/**
 * Parse Zoho error response
 * @param {Object} error - Error object from Zoho API
 * @returns {Object} Parsed error details
 */
function parseZohoError(error) {
  const parsed = {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    details: null,
    statusCode: null
  };

  if (error.response) {
    const data = error.response.data;
    parsed.statusCode = error.response.status;

    if (data) {
      parsed.code = data.code || error.response.status;
      parsed.message = data.message || error.message;
      parsed.details = data;
    }
  } else if (error.message) {
    parsed.message = error.message;
  }

  return parsed;
}

/**
 * Retry async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise<any>} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone to validate
 * @returns {boolean} True if valid
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 9;
}

/**
 * Extract error message from various error formats
 * @param {any} error - Error object
 * @returns {string} Error message
 */
function extractErrorMessage(error) {
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error && error.error.message) return error.error.message;
  if (error.response && error.response.data) {
    if (error.response.data.message) return error.response.data.message;
    if (typeof error.response.data === 'string') return error.response.data;
  }
  return 'An unexpected error occurred';
}

/**
 * Create safe logger that respects environment
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {any} args - Arguments to log
 */
function log(level, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [ZOHO] [${level.toUpperCase()}]`;

  if (process.env.NODE_ENV === 'production' && level === 'debug') {
    return; // Skip debug logs in production
  }

  switch (level) {
    case 'error':
      console.error(prefix, ...args);
      break;
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'debug':
      console.debug(prefix, ...args);
      break;
    default:
      console.log(prefix, ...args);
  }
}

/**
 * Map payment method from various formats to Zoho format
 * @param {string} method - Payment method
 * @returns {string} Zoho payment mode
 */
function mapPaymentMethod(method) {
  if (!method) return 'cash';

  const normalized = method.toLowerCase().replace(/[\s\-_]/g, '');

  const mapping = {
    'mpesa': 'mpesa',
    'm-pesa': 'mpesa',
    'mobilemoney': 'mpesa',
    'bank': 'bank_transfer',
    'banktransfer': 'bank_transfer',
    'transfer': 'bank_transfer',
    'card': 'creditcard',
    'creditcard': 'creditcard',
    'debitcard': 'creditcard',
    'cheque': 'check',
    'check': 'check',
    'cash': 'cash',
    'paypal': 'paypal',
    'stripe': 'creditcard'
  };

  for (const [key, value] of Object.entries(mapping)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return 'cash'; // Default
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array<Array>} Chunked arrays
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create summary of invoice for logging
 * @param {Object} invoice - Invoice object
 * @returns {string} Summary string
 */
function createInvoiceSummary(invoice) {
  return `Invoice: ${invoice.invoice_number || 'N/A'} | ` +
         `Customer: ${invoice.customer_name || 'N/A'} | ` +
         `Total: ${invoice.currency_code || 'KES'} ${invoice.total || 0} | ` +
         `Status: ${invoice.status || 'draft'}`;
}

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of visible characters at start/end
 * @returns {string} Masked data
 */
function maskSensitiveData(data, visibleChars = 4) {
  if (!data || data.length <= visibleChars * 2) {
    return data;
  }

  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const masked = '*'.repeat(Math.min(data.length - (visibleChars * 2), 10));

  return `${start}${masked}${end}`;
}

/**
 * Validate required fields in object
 * @param {Object} obj - Object to validate
 * @param {Array<string>} requiredFields - Required field names
 * @returns {Object} Validation result
 */
function validateRequiredFields(obj, requiredFields) {
  const missing = [];

  for (const field of requiredFields) {
    if (!obj || obj[field] === null || obj[field] === undefined || obj[field] === '') {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Remove undefined and null values from object
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
function removeEmptyValues(obj) {
  const cleaned = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Truncate string to max length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

module.exports = {
  formatDate,
  formatDateTime,
  calculatePaymentTerms,
  formatAmount,
  formatCurrency,
  sanitizeString,
  buildFullName,
  parseZohoError,
  retryWithBackoff,
  sleep,
  isValidEmail,
  isValidPhone,
  extractErrorMessage,
  log,
  mapPaymentMethod,
  chunkArray,
  createInvoiceSummary,
  maskSensitiveData,
  validateRequiredFields,
  deepClone,
  removeEmptyValues,
  truncateString
};
