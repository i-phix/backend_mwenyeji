const axios = require('axios');
require('dotenv').config();

const ZOHO_CONFIG = {
  accessToken:'1000.8ce22b9c696f859e53c56a941c9bb6b0.22435074a291128e3d1921fe91e7407a',
  organizationId: '902846347',
  baseUrl: 'https://books.zoho.com/api/v3'
};

// Helper function to make Zoho API requests
async function zohoRequest(method, endpoint, data = null, params = {}) {
  try {
    const config = {
      method,
      url: `${ZOHO_CONFIG.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${ZOHO_CONFIG.accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        organization_id: ZOHO_CONFIG.organizationId,
        ...params
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw {
      message: error.response?.data?.message || error.message,
      code: error.response?.data?.code,
      details: error.response?.data
    };
  }
}

// Test 1: Get Organizations
async function testOrganizations() {
  console.log('📋 Test 1: Getting Organizations...');
  try {
    const response = await axios.get(`${ZOHO_CONFIG.baseUrl}/organizations`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${ZOHO_CONFIG.accessToken}`
      }
    });

    if (response.data.organizations && response.data.organizations.length > 0) {
      const org = response.data.organizations.find(o => o.organization_id === ZOHO_CONFIG.organizationId);
      console.log('✅ Organization found:');
      console.log(`   Name: ${org.name}`);
      console.log(`   ID: ${org.organization_id}`);
      console.log(`   Currency: ${org.currency_code}`);
      console.log(`   Time Zone: ${org.time_zone}\n`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    return false;
  }
}

// Test 2: Get or Create Customer
async function testGetOrCreateCustomer() {
  console.log('👤 Test 2: Getting/Creating Customer (Simon Gichu)...');

  try {
    // First, try to find existing customer
    const searchResponse = await zohoRequest('GET', '/contacts', null, {
      contact_name_contains: 'Simon Gichu'
    });

    if (searchResponse.contacts && searchResponse.contacts.length > 0) {
      const customer = searchResponse.contacts[0];
      console.log('✅ Customer found:');
      console.log(`   Name: ${customer.contact_name}`);
      console.log(`   ID: ${customer.contact_id}`);
      console.log(`   Currency: ${customer.currency_code}\n`);
      return customer.contact_id;
    }

    // If not found, create new customer
    console.log('   Customer not found. Creating new customer...');
    const createResponse = await zohoRequest('POST', '/contacts', {
      contact_name: 'Simon Gichu',
      contact_type: 'customer',
      first_name: 'Simon',
      last_name: 'Gichu',
      currency_code: 'KES'
    });

    console.log('✅ Customer created:');
    console.log(`   Name: ${createResponse.contact.contact_name}`);
    console.log(`   ID: ${createResponse.contact.contact_id}\n`);
    return createResponse.contact.contact_id;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    return null;
  }
}

// Test 3: Create Invoice
async function testCreateInvoice(customerId) {
  console.log('📄 Test 3: Creating Test Invoice...');

  if (!customerId) {
    console.error('❌ Cannot create invoice without customer ID\n');
    return null;
  }

  try {
    const invoiceData = {
      customer_id: customerId,
      invoice_number: `TEST-${Date.now()}`,
      reference_number: '6835021',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency_code: 'KES',
      line_items: [
        {
          name: 'Monthly Rent - Test',
          description: 'Monthly Rent - Test Invoice',
          rate: 8000,
          quantity: 1
        },
        {
          name: 'Security Deposit',
          description: 'Security Deposit - Test',
          rate: 8000,
          quantity: 1
        }
      ],
      notes: 'Facility: Knights Bridge\nUnit: KB 46\nAccount Number: 6835021\n\nThis is a test invoice.',
      terms: 'Payment due by due date. Late payments may incur penalties.',
      allow_partial_payments: true
    };

    const response = await zohoRequest('POST', '/invoices', invoiceData, {
      ignore_auto_number_generation: true
    });

    console.log('✅ Invoice created successfully:');
    console.log(`   Invoice ID: ${response.invoice.invoice_id}`);
    console.log(`   Invoice Number: ${response.invoice.invoice_number}`);
    console.log(`   Customer: ${response.invoice.customer_name}`);
    console.log(`   Total: ${response.invoice.currency_code} ${response.invoice.total}`);
    console.log(`   Status: ${response.invoice.status}`);
    console.log(`   Invoice URL: ${response.invoice.invoice_url}\n`);

    return response.invoice;

  } catch (error) {
    console.error('❌ Failed to create invoice:', error.message);
    console.error('   Details:', error.details);
    return null;
  }
}

// Test 4: Get Invoices
async function testGetInvoices() {
  console.log('📋 Test 4: Getting Recent Invoices...');

  try {
    const response = await zohoRequest('GET', '/invoices', null, {
      per_page: 5,
      sort_column: 'created_time',
      sort_order: 'D'
    });

    if (response.invoices && response.invoices.length > 0) {
      console.log(`✅ Found ${response.invoices.length} recent invoices:`);
      response.invoices.forEach((invoice, index) => {
        console.log(`   ${index + 1}. ${invoice.invoice_number} - ${invoice.customer_name} - ${invoice.currency_code} ${invoice.total}`);
      });
      console.log('');
      return true;
    } else {
      console.log('⚠️  No invoices found\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ZOHO BOOKS API CONNECTION TEST');
  console.log('='.repeat(80) + '\n');

  // Validate configuration
  if (!ZOHO_CONFIG.accessToken || !ZOHO_CONFIG.organizationId) {
    console.error('❌ Missing configuration! Please check your .env file:');
    console.error('   - ZOHO_ACCESS_TOKEN');
    console.error('   - ZOHO_ORGANIZATION_ID\n');
    process.exit(1);
  }

  console.log('📝 Configuration:');
  console.log(`   Organization ID: ${ZOHO_CONFIG.organizationId}`);
  console.log(`   Access Token: ${ZOHO_CONFIG.accessToken.substring(0, 20)}...`);
  console.log(`   Base URL: ${ZOHO_CONFIG.baseUrl}\n`);

  let results = {
    organization: false,
    customer: null,
    invoice: null,
    getInvoices: false
  };

  // Run tests
  results.organization = await testOrganizations();

  if (results.organization) {
    results.customer = await testGetOrCreateCustomer();

    if (results.customer) {
      results.invoice = await testCreateInvoice(results.customer);
      results.getInvoices = await testGetInvoices();
    }
  }

  // Summary
  console.log('='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`   Organization Access: ${results.organization ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Customer Operations: ${results.customer ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Invoice Creation: ${results.invoice ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Invoice Retrieval: ${results.getInvoices ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('='.repeat(80));

  if (results.organization && results.customer && results.invoice && results.getInvoices) {
    console.log('\n🎉 ALL TESTS PASSED! You can now integrate with Zoho Books.\n');
    console.log('Next steps:');
    console.log('   1. Review the test invoice in Zoho Books dashboard');
    console.log('   2. Implement the send_invoice.js function');
    console.log('   3. Set up automatic token refresh\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
