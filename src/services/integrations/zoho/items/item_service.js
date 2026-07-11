const { authenticatedRequest } = require("../auth");
const { ZOHO_CONFIG } = require("../config");
const logger = require("../../../../../config/winston");

// In-memory cache for Zoho items
let itemsCache = {
  data: null,
  timestamp: null,
  ttl: 3600000, // 1 hour in milliseconds
};

async function getZohoItems(options = {}) {
  const { forceRefresh = false } = options;

  // Check cache
  const now = Date.now();
  if (
    !forceRefresh &&
    itemsCache.data &&
    itemsCache.timestamp &&
    now - itemsCache.timestamp < itemsCache.ttl
  ) {
    console.log("✅ Using cached Zoho items");
    return itemsCache.data;
  }

  try {
    console.log("🔄 Fetching items from Zoho Books...");

    const response = await authenticatedRequest({
      method: "GET",
      url: ZOHO_CONFIG.endpoints.items,
      params: {
        per_page: 200,
        sort_column: "name",
        sort_order: "A",
      },
    });

    if (response.code === 0 && response.items) {
      const items = response.items;
      console.log(`✅ Fetched ${items.length} item(s) from Zoho Books`);

      // DEBUG: Log the full structure of the first item to see available fields
      if (items.length > 0) {
        console.log("\n🔍 [DEBUG] Sample Zoho Item structure (first item):");
        console.log(JSON.stringify(items[0], null, 2));
        console.log("\n🔍 [DEBUG] All Zoho Items summary:");
        items.forEach((item, idx) => {
          console.log(
            `   ${idx + 1}. "${item.name}" - ID: ${item.item_id}, Account: ${item.account_name || "N/A"} (${item.account_id || "N/A"})`,
          );
        });
      }

      // Update cache
      itemsCache.data = items;
      itemsCache.timestamp = now;

      logger.info("Zoho items fetched and cached", {
        itemCount: items.length,
        cachedUntil: new Date(now + itemsCache.ttl),
      });

      return items;
    }

    console.warn("⚠️  No items returned from Zoho Books");
    return [];
  } catch (error) {
    console.error("❌ Error fetching items from Zoho:", error.message);
    logger.error("Failed to fetch items from Zoho", {
      error: error.message || error,
    });

    // Return cached data if available (stale cache is better than no data)
    if (itemsCache.data) {
      console.log("⚠️  Using stale cached data due to error");
      return itemsCache.data;
    }

    throw {
      message: "Failed to fetch items from Zoho Books",
      originalError: error,
      code: "ITEM_FETCH_FAILED",
    };
  }
}

function matchItemByPrefix(payserveDescription, zohoItems) {
  if (!payserveDescription || typeof payserveDescription !== "string") {
    return null;
  }

  if (!zohoItems || zohoItems.length === 0) {
    return null;
  }

  // Extract text before dash "-" and convert to uppercase
  const dashIndex = payserveDescription.indexOf("-");
  const prefix =
    dashIndex > 0
      ? payserveDescription.substring(0, dashIndex).trim().toUpperCase()
      : payserveDescription.trim().toUpperCase();

  if (!prefix) {
    console.log(`⚠️  Could not extract prefix from "${payserveDescription}"`);
    return null;
  }

  // Find item that starts with the prefix (text before dash)
  const matched = zohoItems.find((item) => {
    const itemName = (item.name || "").toUpperCase();
    return itemName.startsWith(prefix);
  });

  if (matched) {
    console.log(
      `✅ Matched "${payserveDescription}" to Zoho item: "${matched.name}" (ID: ${matched.item_id})`,
    );
  } else {
    console.log(
      `⚠️  No match found for "${payserveDescription}" with prefix "${prefix}"`,
    );
  }

  return matched;
}

function matchMultipleItems(payserveItems, zohoItems) {
  if (!Array.isArray(payserveItems) || payserveItems.length === 0) {
    return [];
  }

  return payserveItems.map((psItem) => {
    const matched = matchItemByPrefix(psItem.description, zohoItems);

    return {
      // Original PayServe data
      original: {
        description: psItem.description,
        quantity: psItem.quantity || 1,
        unitPrice: psItem.unitPrice || psItem.amount || 0,
        amount: psItem.amount || psItem.unitPrice || 0,
      },

      // Zoho item data (if matched)
      zoho: matched
        ? {
            item_id: matched.item_id,
            name: matched.name,
            account_id: matched.account_id,
            account_name: matched.account_name,
            tax_id: matched.tax_id,
            tax_name: matched.tax_name,
          }
        : null,

      // Matching status
      matched: !!matched,
      prefix: (() => {
        const desc = psItem.description || "";
        const dashIndex = desc.indexOf("-");
        return dashIndex > 0
          ? desc.substring(0, dashIndex).trim().toUpperCase()
          : desc.trim().toUpperCase();
      })(),
    };
  });
}

function convertToZohoLineItems(matchedItems) {
  console.log("\n🔍 [DEBUG] Converting matched items to Zoho line items...");

  const lineItems = matchedItems.map((match, index) => {
    const lineItem = {
      description: match.original.description,
      rate: match.original.unitPrice,
      quantity: match.original.quantity,
    };

    // Add item_id if matched (this enables double-entry bookkeeping)
    if (match.matched && match.zoho) {
      lineItem.item_id = match.zoho.item_id;
      lineItem.name = match.zoho.name;

      // DEBUG: Log the full zoho item data we have
      console.log(`   📦 Line Item ${index + 1}:`);
      console.log(`      Description: ${match.original.description}`);
      console.log(`      Rate: ${match.original.unitPrice}`);
      console.log(`      Quantity: ${match.original.quantity}`);
      console.log(`      Zoho Item ID: ${match.zoho.item_id}`);
      console.log(`      Zoho Item Name: ${match.zoho.name}`);
      console.log(
        `      Zoho Account ID: ${match.zoho.account_id || "NOT SET"}`,
      );
      console.log(
        `      Zoho Account Name: ${match.zoho.account_name || "NOT SET"}`,
      );
      console.log(`      Zoho Tax ID: ${match.zoho.tax_id || "NOT SET"}`);

      // Tax is handled automatically by Zoho based on item settings
    } else {
      console.log(`   ⚠️  Line Item ${index + 1} (NOT MATCHED):`);
      console.log(`      Description: ${match.original.description}`);
      console.log(`      Rate: ${match.original.unitPrice}`);
    }

    return lineItem;
  });

  // Log the final payload being sent to Zoho
  console.log("\n📤 [DEBUG] Final line_items payload for Zoho API:");
  console.log(JSON.stringify(lineItems, null, 2));

  return lineItems;
}

/**
 * Clear items cache (useful for testing or forced refresh)
 */
function clearItemsCache() {
  itemsCache.data = null;
  itemsCache.timestamp = null;
  console.log("🗑️  Items cache cleared");
}

/**
 * Get cache status
 * @returns {Object} Cache status information
 */
function getCacheStatus() {
  const now = Date.now();
  const isValid =
    itemsCache.data &&
    itemsCache.timestamp &&
    now - itemsCache.timestamp < itemsCache.ttl;

  return {
    hasCachedData: !!itemsCache.data,
    itemCount: itemsCache.data ? itemsCache.data.length : 0,
    cachedAt: itemsCache.timestamp ? new Date(itemsCache.timestamp) : null,
    expiresAt: itemsCache.timestamp
      ? new Date(itemsCache.timestamp + itemsCache.ttl)
      : null,
    isValid,
    ageInMinutes: itemsCache.timestamp
      ? Math.round((now - itemsCache.timestamp) / 60000)
      : null,
  };
}

module.exports = {
  getZohoItems,
  matchItemByPrefix,
  matchMultipleItems,
  convertToZohoLineItems,
  clearItemsCache,
  getCacheStatus,
};
