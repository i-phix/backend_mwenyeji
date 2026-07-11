/**
 * Setup Zoho Books Items Script
 *
 * This script creates all necessary items in Zoho Books and links them
 * to the appropriate Chart of Accounts for double-entry bookkeeping.
 *
 * Usage:
 *   node scripts/setup_zoho_items.js [facilityId]
 *
 * Example:
 *   node scripts/setup_zoho_items.js 68354b430bfa0b7ac72078c5
 *
 * Steps:
 * 1. Lists existing items in Zoho Books
 * 2. Lists accounts for mapping
 * 3. Creates missing items
 * 4. Links items to accounts
 * 5. Saves item IDs for future use
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const API_TIMEOUT = 30000;

// ANSI color codes for pretty console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  const line = '='.repeat(80);
  console.log('');
  log(line, 'cyan');
  log(`  ${title}`, 'bright');
  log(line, 'cyan');
  console.log('');
}

function section(title) {
  console.log('');
  log(`▶ ${title}`, 'blue');
  log('─'.repeat(80), 'blue');
}

/**
 * Get facility ID from command line or prompt
 */
function getFacilityId() {
  const facilityId = process.argv[2];

  if (!facilityId) {
    log('❌ Error: Facility ID is required', 'red');
    log('Usage: node scripts/setup_zoho_items.js <facilityId>', 'yellow');
    log('Example: node scripts/setup_zoho_items.js 68354b430bfa0b7ac72078c5', 'yellow');
    process.exit(1);
  }

  return facilityId;
}

/**
 * List existing items in Zoho Books
 */
async function listZohoItems(facilityId) {
  try {
    section('Fetching existing items from Zoho Books');

    const response = await axios.get(`${API_BASE_URL}/api/integrations/zoho/items/list`, {
      params: { facilityId },
      timeout: API_TIMEOUT,
    });

    if (response.data.success) {
      const items = response.data.items || [];
      log(`✅ Found ${items.length} existing item(s) in Zoho Books`, 'green');

      if (items.length > 0) {
        console.log('');
        log('Existing Items:', 'cyan');
        items.slice(0, 10).forEach((item, idx) => {
          console.log(`  ${idx + 1}. ${item.name} (ID: ${item.item_id})`);
          if (item.account_name) {
            console.log(`     → Account: ${item.account_name}`);
          }
        });

        if (items.length > 10) {
          console.log(`  ... and ${items.length - 10} more`);
        }
      }

      return items;
    } else {
      log('⚠️  Could not fetch items from Zoho', 'yellow');
      return [];
    }
  } catch (error) {
    log(`⚠️  Error fetching items: ${error.message}`, 'yellow');
    return [];
  }
}

/**
 * List Chart of Accounts
 */
async function listAccounts(facilityId) {
  try {
    section('Fetching Chart of Accounts from Zoho Books');

    const response = await axios.get(`${API_BASE_URL}/api/integrations/zoho/accounts/list`, {
      params: { facilityId },
      timeout: API_TIMEOUT,
    });

    if (response.data.success) {
      const accounts = response.data.accounts || [];
      log(`✅ Found ${accounts.length} account(s)`, 'green');

      // Group accounts by type
      const incomeAccounts = accounts.filter(a => a.account_type === 'income');
      const assetAccounts = accounts.filter(a => a.account_type === 'asset');
      const liabilityAccounts = accounts.filter(a => a.account_type === 'liability');

      if (incomeAccounts.length > 0) {
        console.log('');
        log('Income Accounts (for linking items):', 'cyan');
        incomeAccounts.forEach((acc, idx) => {
          console.log(`  ${idx + 1}. ${acc.account_name} (ID: ${acc.account_id})`);
        });
      }

      return {
        all: accounts,
        income: incomeAccounts,
        asset: assetAccounts,
        liability: liabilityAccounts,
      };
    } else {
      log('⚠️  Could not fetch accounts from Zoho', 'yellow');
      return { all: [], income: [], asset: [], liability: [] };
    }
  } catch (error) {
    log(`⚠️  Error fetching accounts: ${error.message}`, 'yellow');
    return { all: [], income: [], asset: [], liability: [] };
  }
}

/**
 * Create item in Zoho Books
 */
async function createItem(facilityId, itemData) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/integrations/zoho/items/create`,
      {
        facilityId,
        ...itemData,
      },
      { timeout: API_TIMEOUT }
    );

    if (response.data.success) {
      return {
        success: true,
        item: response.data.item,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Unknown error',
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Setup items with manual account selection
 */
async function setupItemsManually(facilityId, accounts) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  header('Manual Item Setup');

  log('You will be prompted to select accounts for each item type.', 'yellow');
  log('Press Ctrl+C to cancel at any time.', 'yellow');
  console.log('');

  // Define items to create
  const itemsToCreate = [
    { name: 'Monthly Rent', description: 'Monthly rental charges for leased property' },
    { name: 'Service Charge', description: 'Common area maintenance and service charges' },
    { name: 'Water Charges', description: 'Water consumption charges' },
    { name: 'Electricity Charges', description: 'Electricity consumption charges' },
    { name: 'Parking Fee', description: 'Parking space rental fee' },
    { name: 'Late Payment Fee', description: 'Penalty for late payment' },
    { name: 'Maintenance Fee', description: 'Property maintenance charges' },
    { name: 'Other Charges', description: 'Miscellaneous charges' },
  ];

  const createdItems = [];

  for (const itemTemplate of itemsToCreate) {
    section(`Setting up: ${itemTemplate.name}`);

    console.log('');
    log('Available Income Accounts:', 'cyan');
    accounts.income.forEach((acc, idx) => {
      console.log(`  ${idx + 1}. ${acc.account_name} (ID: ${acc.account_id})`);
    });
    console.log('  0. Skip this item');

    const choice = await question(`\nSelect account for "${itemTemplate.name}" (1-${accounts.income.length} or 0): `);
    const choiceNum = parseInt(choice);

    if (choiceNum === 0) {
      log(`⏭️  Skipped: ${itemTemplate.name}`, 'yellow');
      continue;
    }

    if (choiceNum < 1 || choiceNum > accounts.income.length) {
      log(`❌ Invalid choice. Skipping ${itemTemplate.name}`, 'red');
      continue;
    }

    const selectedAccount = accounts.income[choiceNum - 1];

    log(`Creating "${itemTemplate.name}" linked to "${selectedAccount.account_name}"...`, 'cyan');

    const result = await createItem(facilityId, {
      name: itemTemplate.name,
      description: itemTemplate.description,
      accountId: selectedAccount.account_id,
      rate: 0,
      itemType: 'sales',
    });

    if (result.success) {
      log(`✅ Created: ${result.item.name} (ID: ${result.item.item_id})`, 'green');
      createdItems.push(result.item);
    } else {
      log(`❌ Failed to create "${itemTemplate.name}": ${result.error}`, 'red');
    }

    console.log('');
  }

  rl.close();

  return createdItems;
}

/**
 * Setup items automatically (requires pre-configured accounts)
 */
async function setupItemsAutomatically(facilityId, accounts) {
  header('Automatic Item Setup');

  log('Attempting to auto-create items using default account names...', 'yellow');
  console.log('');

  // Account name mappings
  const accountMappings = {
    'Monthly Rent': ['Rental Income', 'Rent Income', 'Income - Rental'],
    'Service Charge': ['Service Charge Income', 'Service Charges', 'Income - Service'],
    'Water Charges': ['Utility Income - Water', 'Water Income', 'Income - Water'],
    'Electricity Charges': ['Utility Income - Electricity', 'Power Income', 'Income - Electricity'],
    'Parking Fee': ['Parking Income', 'Income - Parking'],
    'Late Payment Fee': ['Other Income', 'Penalties', 'Late Fees'],
    'Maintenance Fee': ['Maintenance Income', 'Income - Maintenance'],
    'Other Charges': ['Other Income', 'Miscellaneous Income'],
  };

  const itemsToCreate = [
    { name: 'Monthly Rent', description: 'Monthly rental charges for leased property', mapping: accountMappings['Monthly Rent'] },
    { name: 'Service Charge', description: 'Common area maintenance and service charges', mapping: accountMappings['Service Charge'] },
    { name: 'Water Charges', description: 'Water consumption charges', mapping: accountMappings['Water Charges'] },
    { name: 'Electricity Charges', description: 'Electricity consumption charges', mapping: accountMappings['Electricity Charges'] },
    { name: 'Parking Fee', description: 'Parking space rental fee', mapping: accountMappings['Parking Fee'] },
    { name: 'Late Payment Fee', description: 'Penalty for late payment', mapping: accountMappings['Late Payment Fee'] },
    { name: 'Maintenance Fee', description: 'Property maintenance charges', mapping: accountMappings['Maintenance Fee'] },
    { name: 'Other Charges', description: 'Miscellaneous charges', mapping: accountMappings['Other Charges'] },
  ];

  const createdItems = [];
  let skipped = 0;

  for (const itemTemplate of itemsToCreate) {
    section(`Creating: ${itemTemplate.name}`);

    // Find matching account
    let matchedAccount = null;

    for (const accountName of itemTemplate.mapping) {
      matchedAccount = accounts.income.find(acc =>
        acc.account_name.toLowerCase().includes(accountName.toLowerCase())
      );
      if (matchedAccount) break;
    }

    if (!matchedAccount) {
      log(`⚠️  No matching account found for "${itemTemplate.name}". Skipping.`, 'yellow');
      log(`   Searched for: ${itemTemplate.mapping.join(', ')}`, 'yellow');
      skipped++;
      continue;
    }

    log(`📎 Linking to account: ${matchedAccount.account_name}`, 'cyan');

    const result = await createItem(facilityId, {
      name: itemTemplate.name,
      description: itemTemplate.description,
      accountId: matchedAccount.account_id,
      rate: 0,
      itemType: 'sales',
    });

    if (result.success) {
      log(`✅ Created: ${result.item.name} (ID: ${result.item.item_id})`, 'green');
      createdItems.push(result.item);
    } else {
      log(`❌ Failed: ${result.error}`, 'red');
    }

    console.log('');
  }

  if (skipped > 0) {
    log(`⚠️  ${skipped} item(s) were skipped due to missing accounts`, 'yellow');
    log(`   Run with --manual flag for manual account selection`, 'yellow');
  }

  return createdItems;
}

/**
 * Main execution
 */
async function main() {
  try {
    header('Zoho Books Item Setup Script');

    const facilityId = getFacilityId();
    log(`Facility ID: ${facilityId}`, 'cyan');

    // Check if manual mode
    const isManual = process.argv.includes('--manual');

    // Step 1: List existing items
    const existingItems = await listZohoItems(facilityId);

    // Step 2: List accounts
    const accounts = await listAccounts(facilityId);

    if (accounts.income.length === 0) {
      log('❌ Error: No income accounts found in Zoho Books', 'red');
      log('   Please create income accounts in Zoho Books first:', 'yellow');
      log('   - Rental Income', 'yellow');
      log('   - Service Charge Income', 'yellow');
      log('   - Utility Income - Water', 'yellow');
      log('   - Utility Income - Electricity', 'yellow');
      log('   - etc.', 'yellow');
      process.exit(1);
    }

    // Step 3: Create items
    let createdItems;

    if (isManual) {
      createdItems = await setupItemsManually(facilityId, accounts);
    } else {
      createdItems = await setupItemsAutomatically(facilityId, accounts);
    }

    // Step 4: Summary
    header('Setup Complete!');

    log(`✅ Created ${createdItems.length} item(s) in Zoho Books`, 'green');
    console.log('');

    if (createdItems.length > 0) {
      log('Created Items:', 'cyan');
      createdItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.name}`);
        console.log(`     ID: ${item.item_id}`);
        if (item.account_name) {
          console.log(`     Account: ${item.account_name}`);
        }
      });
      console.log('');
    }

    log('Next Steps:', 'yellow');
    log('1. Update item_mapping.js with the created item IDs', 'white');
    log('2. Update account IDs in the mapping', 'white');
    log('3. Test invoice creation with the new items', 'white');
    console.log('');

    // Save item IDs to file for reference
    const outputFile = path.join(__dirname, 'zoho_items_output.json');
    fs.writeFileSync(outputFile, JSON.stringify({
      facilityId,
      timestamp: new Date().toISOString(),
      items: createdItems,
    }, null, 2));

    log(`📄 Item IDs saved to: ${outputFile}`, 'cyan');

  } catch (error) {
    log(`❌ Fatal Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
