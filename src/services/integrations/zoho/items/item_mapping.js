/**
 * PayServe to Zoho Books Item Mapping
 * Maps PayServe charge types to Zoho Books items with their corresponding accounts
 *
 * IMPORTANT: Update the account IDs and item IDs with actual values from your Zoho Books instance
 * To get these IDs:
 * 1. Go to Zoho Books > Settings > Chart of Accounts
 * 2. Click on each account to see its ID in the URL
 * 3. Go to Items to get item IDs
 */

/**
 * Standard Chart of Accounts Structure in Zoho Books
 *
 * INCOME ACCOUNTS:
 * - Rental Income (4001)
 * - Service Charge Income (4002)
 * - Utility Income - Water (4003)
 * - Utility Income - Electricity (4004)
 * - Parking Income (4005)
 * - Other Income - Penalties (4099)
 *
 * ASSET ACCOUNTS:
 * - Accounts Receivable (1200)
 * - Cash (1001)
 * - Bank Account (1002)
 *
 * LIABILITY ACCOUNTS:
 * - VAT Output (2300)
 * - Customer Deposits (2400)
 */

/**
 * Item mapping configuration
 * Each charge type in PayServe maps to a Zoho item with specific account
 */
const ITEM_MAPPING = {
  // Rental charges
  "Monthly Rent": {
    zohoItemId: null, // Will be auto-created if null
    zohoItemName: "Monthly Rent",
    description: "Monthly rental charges for leased property",
    accountId: null, // Set to your "Rental Income" account ID
    accountName: "Rental Income",
    taxId: null, // Set to your VAT 16% tax ID (or null for exempt)
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0, // Rate varies per unit
  },

  // Service charges
  "Service Charge": {
    zohoItemId: null,
    zohoItemName: "Service Charge",
    description: "Common area maintenance and service charges",
    accountId: null, // Set to your "Service Charge Income" account ID
    accountName: "Service Charge Income",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  // Utilities
  "Water": {
    zohoItemId: null,
    zohoItemName: "Water Charges",
    description: "Water consumption charges",
    accountId: null, // Set to your "Utility Income - Water" account ID
    accountName: "Utility Income - Water",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  "Electricity": {
    zohoItemId: null,
    zohoItemName: "Electricity Charges",
    description: "Electricity consumption charges",
    accountId: null, // Set to your "Utility Income - Electricity" account ID
    accountName: "Utility Income - Electricity",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  "Power": {
    zohoItemId: null,
    zohoItemName: "Electricity Charges",
    description: "Electricity consumption charges",
    accountId: null,
    accountName: "Utility Income - Electricity",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  // Parking
  "Parking": {
    zohoItemId: null,
    zohoItemName: "Parking Fee",
    description: "Parking space rental fee",
    accountId: null, // Set to your "Parking Income" account ID
    accountName: "Parking Income",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  "Parking Fee": {
    zohoItemId: null,
    zohoItemName: "Parking Fee",
    description: "Parking space rental fee",
    accountId: null,
    accountName: "Parking Income",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  // Late fees and penalties
  "Late Fee": {
    zohoItemId: null,
    zohoItemName: "Late Payment Fee",
    description: "Penalty for late payment",
    accountId: null, // Set to your "Other Income - Penalties" account ID
    accountName: "Other Income - Penalties",
    taxId: null, // Usually exempt
    taxName: "Exempt",
    itemType: "sales",
    defaultRate: 0,
  },

  "Late Payment Fee": {
    zohoItemId: null,
    zohoItemName: "Late Payment Fee",
    description: "Penalty for late payment",
    accountId: null,
    accountName: "Other Income - Penalties",
    taxId: null,
    taxName: "Exempt",
    itemType: "sales",
    defaultRate: 0,
  },

  "Penalty": {
    zohoItemId: null,
    zohoItemName: "Late Payment Fee",
    description: "Penalty for late payment",
    accountId: null,
    accountName: "Other Income - Penalties",
    taxId: null,
    taxName: "Exempt",
    itemType: "sales",
    defaultRate: 0,
  },

  // Security deposit
  "Security Deposit": {
    zohoItemId: null,
    zohoItemName: "Security Deposit",
    description: "Refundable security deposit",
    accountId: null, // Set to your "Customer Deposits" liability account ID
    accountName: "Customer Deposits",
    taxId: null,
    taxName: "Exempt",
    itemType: "sales",
    defaultRate: 0,
  },

  // Maintenance
  "Maintenance Fee": {
    zohoItemId: null,
    zohoItemName: "Maintenance Fee",
    description: "Property maintenance charges",
    accountId: null,
    accountName: "Maintenance Income",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  // Booking/Reservation fees
  "Booking Fee": {
    zohoItemId: null,
    zohoItemName: "Booking Fee",
    description: "Facility booking charges",
    accountId: null,
    accountName: "Booking Income",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },

  // Default/fallback item
  "Other Charges": {
    zohoItemId: null,
    zohoItemName: "Other Charges",
    description: "Miscellaneous charges",
    accountId: null,
    accountName: "Other Income",
    taxId: null,
    taxName: "VAT 16%",
    itemType: "sales",
    defaultRate: 0,
  },
};

/**
 * Get item mapping by charge description
 * @param {string} chargeDescription - PayServe charge description
 * @returns {Object|null} Item mapping configuration
 */
function getItemMapping(chargeDescription) {
  if (!chargeDescription) {
    return ITEM_MAPPING["Other Charges"];
  }

  // Direct match
  if (ITEM_MAPPING[chargeDescription]) {
    return ITEM_MAPPING[chargeDescription];
  }

  // Fuzzy match (case-insensitive, partial match)
  const normalized = chargeDescription.toLowerCase().trim();

  // Check for rent-related charges
  if (normalized.includes("rent")) {
    return ITEM_MAPPING["Monthly Rent"];
  }

  // Check for service charge
  if (normalized.includes("service")) {
    return ITEM_MAPPING["Service Charge"];
  }

  // Check for water
  if (normalized.includes("water")) {
    return ITEM_MAPPING["Water"];
  }

  // Check for electricity/power
  if (normalized.includes("electric") || normalized.includes("power")) {
    return ITEM_MAPPING["Electricity"];
  }

  // Check for parking
  if (normalized.includes("parking")) {
    return ITEM_MAPPING["Parking"];
  }

  // Check for late fees/penalties
  if (
    normalized.includes("late") ||
    normalized.includes("penalty") ||
    normalized.includes("fine")
  ) {
    return ITEM_MAPPING["Late Fee"];
  }

  // Check for maintenance
  if (normalized.includes("maintenance")) {
    return ITEM_MAPPING["Maintenance Fee"];
  }

  // Check for booking
  if (normalized.includes("booking") || normalized.includes("reservation")) {
    return ITEM_MAPPING["Booking Fee"];
  }

  // Check for deposit
  if (normalized.includes("deposit")) {
    return ITEM_MAPPING["Security Deposit"];
  }

  // Default fallback
  return ITEM_MAPPING["Other Charges"];
}

/**
 * Map PayServe invoice item to Zoho format
 * @param {Object} payserveItem - PayServe invoice line item
 * @param {string} payserveItem.description - Item description
 * @param {number} payserveItem.quantity - Quantity
 * @param {number} payserveItem.unitPrice - Unit price
 * @param {number} payserveItem.amount - Total amount
 * @returns {Object} Zoho-formatted line item
 */
function mapPayServeItemToZoho(payserveItem) {
  const {
    description,
    quantity = 1,
    unitPrice,
    amount,
  } = payserveItem;

  const mapping = getItemMapping(description);

  // Build Zoho line item
  const zohoItem = {
    name: mapping.zohoItemName,
    description: description || mapping.description,
    rate: unitPrice || amount || 0,
    quantity: quantity,
    item_total: amount || unitPrice * quantity || 0,
  };

  // Add item ID if available
  if (mapping.zohoItemId) {
    zohoItem.item_id = mapping.zohoItemId;
  }

  // Add account ID if available
  if (mapping.accountId) {
    zohoItem.account_id = mapping.accountId;
  }

  // Add tax ID if available
  if (mapping.taxId) {
    zohoItem.tax_id = mapping.taxId;
  }

  return zohoItem;
}

/**
 * Map multiple PayServe items to Zoho format
 * @param {Array<Object>} payserveItems - Array of PayServe invoice items
 * @returns {Array<Object>} Array of Zoho-formatted line items
 */
function mapPayServeItemsToZoho(payserveItems) {
  if (!Array.isArray(payserveItems) || payserveItems.length === 0) {
    return [];
  }

  return payserveItems.map(mapPayServeItemToZoho);
}

/**
 * Get all item mappings
 * @returns {Object} All item mappings
 */
function getAllItemMappings() {
  return ITEM_MAPPING;
}

/**
 * Get list of unmapped items (items without Zoho item IDs)
 * @returns {Array<string>} Array of unmapped item names
 */
function getUnmappedItems() {
  return Object.entries(ITEM_MAPPING)
    .filter(([_, mapping]) => !mapping.zohoItemId)
    .map(([name, _]) => name);
}

/**
 * Update item mapping with Zoho IDs
 * @param {string} itemName - Item name
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
function updateItemMapping(itemName, updates) {
  if (!ITEM_MAPPING[itemName]) {
    return false;
  }

  ITEM_MAPPING[itemName] = {
    ...ITEM_MAPPING[itemName],
    ...updates,
  };

  return true;
}

/**
 * Validate if item mapping is complete (has required IDs)
 * @param {string} itemName - Item name
 * @returns {Object} Validation result
 */
function validateItemMapping(itemName) {
  const mapping = ITEM_MAPPING[itemName];

  if (!mapping) {
    return {
      valid: false,
      errors: ["Item mapping not found"],
    };
  }

  const errors = [];

  if (!mapping.zohoItemId) {
    errors.push("Missing Zoho item ID");
  }

  if (!mapping.accountId) {
    errors.push("Missing account ID");
  }

  return {
    valid: errors.length === 0,
    errors,
    mapping,
  };
}

module.exports = {
  ITEM_MAPPING,
  getItemMapping,
  mapPayServeItemToZoho,
  mapPayServeItemsToZoho,
  getAllItemMappings,
  getUnmappedItems,
  updateItemMapping,
  validateItemMapping,
};
