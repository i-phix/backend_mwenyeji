/**
 * Mark Existing Draft Invoices as Sent in Zoho Books
 *
 * This script fetches all draft invoices from Zoho Books
 * and marks them as "sent" status.
 *
 * Usage:
 *   node scripts/mark_invoices_sent.js
 *
 * Optional: Mark specific invoice by ID
 *   node scripts/mark_invoices_sent.js INVOICE_ID
 */

require('dotenv').config();
const axios = require('axios');

// Zoho Books Configuration
const ZOHO_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  organizationId: process.env.ZOHO_ORGANIZATION_ID,
  apiBaseUrl: process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.com/books/v3',
  oauthUrl: process.env.ZOHO_OAUTH_URL || 'https://accounts.zoho.com/oauth/v2'
};

let accessToken = null;

/**
 * Refresh Zoho access token
 */
async function refreshAccessToken() {
  try {
    console.log('🔄 Refreshing access token...');

    const response = await axios.post(`${ZOHO_CONFIG.oauthUrl}/token`, null, {
      params: {
        refresh_token: ZOHO_CONFIG.refreshToken,
        client_id: ZOHO_CONFIG.clientId,
        client_secret: ZOHO_CONFIG.clientSecret,
        grant_type: 'refresh_token'
      }
    });

    accessToken = response.data.access_token;
    console.log('✅ Access token refreshed\n');
    return accessToken;
  } catch (error) {
    console.error('❌ Failed to refresh access token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Make authenticated request to Zoho API
 */
async function makeRequest(method, endpoint, data = null) {
  if (!accessToken) {
    await refreshAccessToken();
  }

  try {
    const config = {
      method,
      url: `${ZOHO_CONFIG.apiBaseUrl}${endpoint}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        organization_id: ZOHO_CONFIG.organizationId
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, refresh and retry
      await refreshAccessToken();
      return makeRequest(method, endpoint, data);
    }
    throw error;
  }
}

/**
 * Get all draft invoices
 */
async function getDraftInvoices() {
  try {
    console.log('📋 Fetching draft invoices from Zoho Books...\n');

    const response = await makeRequest('GET', '/invoices?status=draft');

    if (response.code === 0 && response.invoices) {
      return response.invoices;
    }

    return [];
  } catch (error) {
    console.error('❌ Failed to fetch invoices:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get invoice by ID
 */
async function getInvoiceById(invoiceId) {
  try {
    const response = await makeRequest('GET', `/invoices/${invoiceId}`);

    if (response.code === 0 && response.invoice) {
      return response.invoice;
    }

    return null;
  } catch (error) {
    console.error(`❌ Failed to fetch invoice ${invoiceId}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Mark invoice as sent
 */
async function markInvoiceAsSent(invoiceId, invoiceNumber) {
  try {
    console.log(`📧 Marking invoice ${invoiceNumber} (${invoiceId}) as sent...`);

    const response = await makeRequest('POST', `/invoices/${invoiceId}/status/sent`);

    if (response.code === 0) {
      console.log(`✅ Success: ${invoiceNumber} marked as sent\n`);
      return true;
    }

    console.log(`⚠️  Failed: ${invoiceNumber} - ${response.message}\n`);
    return false;
  } catch (error) {
    console.error(`❌ Error: ${invoiceNumber} -`, error.response?.data?.message || error.message);
    console.error('');
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('📧 MARK ZOHO INVOICES AS SENT');
  console.log('='.repeat(80) + '\n');

  // Validate configuration
  if (!ZOHO_CONFIG.refreshToken || !ZOHO_CONFIG.organizationId) {
    console.error('❌ Error: Missing Zoho configuration in .env file');
    console.error('Required: ZOHO_REFRESH_TOKEN, ZOHO_ORGANIZATION_ID\n');
    process.exit(1);
  }

  const specificInvoiceId = process.argv[2];

  try {
    let invoicesToMark = [];

    if (specificInvoiceId) {
      // Mark specific invoice
      console.log(`🔍 Fetching invoice: ${specificInvoiceId}\n`);
      const invoice = await getInvoiceById(specificInvoiceId);

      if (!invoice) {
        console.error(`❌ Invoice not found: ${specificInvoiceId}\n`);
        process.exit(1);
      }

      if (invoice.status.toLowerCase() === 'sent') {
        console.log(`ℹ️  Invoice ${invoice.invoice_number} is already marked as sent\n`);
        process.exit(0);
      }

      invoicesToMark = [invoice];
    } else {
      // Get all draft invoices
      invoicesToMark = await getDraftInvoices();

      if (invoicesToMark.length === 0) {
        console.log('ℹ️  No draft invoices found. All invoices are already sent or paid!\n');
        process.exit(0);
      }

      console.log(`📊 Found ${invoicesToMark.length} draft invoice(s)\n`);
      console.log('Invoices to be marked as sent:');
      invoicesToMark.forEach((inv, idx) => {
        console.log(`  ${idx + 1}. ${inv.invoice_number} - ${inv.customer_name} - ${inv.currency_code} ${inv.total}`);
      });
      console.log('');
    }

    // Confirmation
    if (!specificInvoiceId && invoicesToMark.length > 5) {
      console.log('⚠️  You are about to mark ' + invoicesToMark.length + ' invoices as sent.');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Mark each invoice as sent
    let successCount = 0;
    let failCount = 0;

    console.log('Starting to mark invoices as sent...\n');
    console.log('-'.repeat(80) + '\n');

    for (const invoice of invoicesToMark) {
      const success = await markInvoiceAsSent(invoice.invoice_id, invoice.invoice_number);

      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('-'.repeat(80));
    console.log('\n📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Invoices:  ${invoicesToMark.length}`);
    console.log(`✅ Successful:    ${successCount}`);
    console.log(`❌ Failed:        ${failCount}`);
    console.log('='.repeat(80) + '\n');

    if (successCount > 0) {
      console.log('✅ Success! Invoices have been marked as sent in Zoho Books.');
      console.log('   Check your Zoho Books dashboard to verify.\n');
    }

    if (failCount > 0) {
      console.log('⚠️  Some invoices failed to update. Check the errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
