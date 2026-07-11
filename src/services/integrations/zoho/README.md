# Zoho Books Integration

Complete integration with Zoho Books API for sending invoices, managing customers, and recording payments.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

---

## Overview

This integration allows you to seamlessly sync invoices from your system to Zoho Books. It handles:

- **Customer Management**: Automatically creates or finds customers in Zoho Books
- **Invoice Creation**: Maps your invoice structure to Zoho's format
- **Payment Recording**: Records payments for paid invoices
- **Token Management**: Automatic OAuth token refresh
- **Error Handling**: Comprehensive error handling with retries

---

## Features

✅ **Automatic Token Refresh** - OAuth tokens are automatically refreshed when they expire
✅ **Customer Auto-Creation** - Customers are created in Zoho if they don't exist
✅ **Duplicate Prevention** - Checks for existing invoices before creating
✅ **Payment Recording** - Automatically records payments for paid invoices
✅ **Bulk Operations** - Send multiple invoices at once
✅ **Comprehensive Logging** - Detailed logs for debugging
✅ **Error Recovery** - Automatic retries with exponential backoff
✅ **Data Validation** - Validates invoice data before sending

---

## Prerequisites

1. **Zoho Books Account** - [Sign up here](https://www.zoho.com/books/)
2. **Zoho API Credentials** - Create a client application in [Zoho API Console](https://api-console.zoho.com/)
3. **Node.js** - Version 14 or higher
4. **Required npm packages**:
   ```bash
   npm install axios dotenv
   ```

---

## Installation

1. **Clone the repository** (if not already done)

2. **Install dependencies**:
   ```bash
   cd backend_main
   npm install
   ```

3. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Configure Zoho credentials** (see Configuration section below)

---

## Configuration

### Step 1: Create Zoho API Client

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Click **"Add Client"** → Select **"Self Client"** or **"Server-based Applications"**
3. Fill in the details:
   - Client Name: "Your App Name"
   - Homepage URL: Your website URL
   - Authorized Redirect URIs: `http://localhost:3000/callback`

4. Note down:
   - **Client ID**
   - **Client Secret**

### Step 2: Get Authorization Code

Visit this URL in your browser (replace `YOUR_CLIENT_ID`):

```
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoBooks.fullaccess.all&client_id=YOUR_CLIENT_ID&response_type=code&access_type=offline&redirect_uri=http://localhost:3000/callback
```

After authorizing, you'll get a **code** in the redirect URL.

### Step 3: Exchange Code for Tokens

Run this cURL command (replace values):

```bash
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "code=YOUR_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "grant_type=authorization_code"
```

You'll receive:
- **access_token** (expires in 1 hour)
- **refresh_token** (never expires - keep this safe!)

### Step 4: Configure Environment Variables

Add these to your `.env` file:

```env
# Zoho Books Configuration
ZOHO_CLIENT_ID=1000.YOUR_CLIENT_ID
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_ACCESS_TOKEN=1000.your_access_token
ZOHO_REFRESH_TOKEN=1000.your_refresh_token
ZOHO_ORGANIZATION_ID=your_organization_id
ZOHO_API_BASE_URL=https://www.zohoapis.com/books/v3

# Optional
ZOHO_LOG_LEVEL=info
NODE_ENV=development
```

### Step 5: Get Organization ID

Run this cURL command:

```bash
curl -X GET "https://www.zohoapis.com/books/v3/organizations" \
  -H "Authorization: Zoho-oauthtoken YOUR_ACCESS_TOKEN"
```

Copy the `organization_id` from the response.

---

## Quick Start

### Test Connection

```javascript
const { testZohoConnection } = require('./services/integrations/zoho/send_invoice');

async function test() {
  const result = await testZohoConnection();
  console.log(result);
}

test();
```

### Send a Single Invoice

```javascript
const { sendInvoiceToZoho } = require('./services/integrations/zoho/send_invoice');

async function sendInvoice() {
  const invoiceData = {
    invoiceNumber: "INV-001",
    accountNumber: "ACC-001",
    client: {
      firstName: "John",
      lastName: "Doe"
    },
    currency: {
      code: "KES"
    },
    items: [
      {
        description: "Monthly Rent",
        quantity: 1,
        unitPrice: 10000
      }
    ],
    totalAmount: 10000,
    amountPaid: 0,
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Unpaid"
  };

  const result = await sendInvoiceToZoho(invoiceData, {
    skipIfExists: true,
    recordPayment: false,
    markAsSent: true
  });

  if (result.success) {
    console.log('✅ Invoice sent!');
    console.log('Invoice ID:', result.data.invoice.id);
    console.log('Invoice URL:', result.data.invoice.url);
  } else {
    console.error('❌ Failed:', result.message);
  }
}

sendInvoice();
```

---

## API Reference

### Main Functions

#### `sendInvoiceToZoho(invoiceData, options)`

Send a single invoice to Zoho Books.

**Parameters:**
- `invoiceData` (Object) - Your invoice data
- `options` (Object) - Configuration options
  - `skipIfExists` (Boolean) - Skip if invoice already exists (default: `true`)
  - `recordPayment` (Boolean) - Record payment if paid (default: `true`)
  - `markAsSent` (Boolean) - Mark invoice as sent (default: `false`)

**Returns:** `Promise<Object>`

```javascript
{
  success: true,
  message: "Invoice successfully sent to Zoho Books",
  data: {
    customer: { id, name, isNew },
    invoice: { id, number, total, balance, status, currency, url },
    payment: { id, amount, reference, date } // if recorded
  },
  errors: [],
  timestamp: "2025-10-22T12:00:00.000Z"
}
```

#### `bulkSendInvoicesToZoho(invoices, options)`

Send multiple invoices in bulk.

**Parameters:**
- `invoices` (Array<Object>) - Array of invoice data
- `options` (Object) - Same as `sendInvoiceToZoho`

**Returns:** `Promise<Object>`

```javascript
{
  total: 10,
  successful: 8,
  failed: 1,
  skipped: 1,
  results: [...]
}
```

#### `testZohoConnection()`

Test connection to Zoho Books API.

**Returns:** `Promise<Object>`

```javascript
{
  success: true,
  message: "Successfully connected to Zoho Books"
}
```

### Module Functions

#### Customer Module (`customer.js`)

- `getOrCreateCustomer(customerData)` - Find or create customer
- `searchCustomerByName(name)` - Search for customer
- `getCustomerById(customerId)` - Get customer details
- `createCustomer(customerData)` - Create new customer
- `updateCustomer(customerId, data)` - Update customer

#### Invoice Module (`invoice.js`)

- `createInvoice(invoiceData)` - Create invoice
- `getInvoiceById(invoiceId)` - Get invoice details
- `searchInvoiceByNumber(number)` - Search for invoice
- `listInvoices(filters)` - List invoices with filters
- `updateInvoice(invoiceId, data)` - Update invoice
- `deleteInvoice(invoiceId)` - Delete invoice
- `markInvoiceAsSent(invoiceId)` - Mark as sent
- `voidInvoice(invoiceId)` - Void invoice

#### Payment Module (`payment.js`)

- `createPayment(paymentData)` - Record payment
- `getPaymentById(paymentId)` - Get payment details
- `listPayments(filters)` - List payments
- `getInvoicePayments(invoiceId)` - Get invoice payments
- `recordInvoicePayment(invoiceData, customerId, invoiceId)` - Record payment for invoice

#### Auth Module (`auth.js`)

- `getValidAccessToken()` - Get valid access token (auto-refreshes)
- `refreshAccessToken()` - Manually refresh token
- `authenticatedRequest(config)` - Make authenticated API request
- `validateCredentials()` - Validate Zoho credentials

---

## Usage Examples

### Example 1: Send Unpaid Invoice

```javascript
const { sendInvoiceToZoho } = require('./services/integrations/zoho/send_invoice');

const invoiceData = {
  invoiceNumber: "LSE251009278",
  accountNumber: "6835021",
  client: {
    firstName: "Simon",
    lastName: "Gichu",
    email: "simon@example.com",
    phone: "+254712345678"
  },
  facility: { name: "Knights Bridge" },
  unit: { name: "KB 46" },
  currency: { code: "KES" },
  items: [
    {
      description: "Monthly Rent - October 2025",
      quantity: 1,
      unitPrice: 8000
    },
    {
      description: "Security Deposit",
      quantity: 1,
      unitPrice: 8000
    }
  ],
  subTotal: 16000,
  tax: 0,
  totalAmount: 16000,
  amountPaid: 0,
  issueDate: "2025-10-09T08:41:16.097Z",
  dueDate: "2025-11-04T21:00:00.000Z",
  status: "Unpaid",
  balanceBroughtForward: 0
};

const result = await sendInvoiceToZoho(invoiceData, {
  skipIfExists: true,
  markAsSent: true
});

console.log(result);
```

### Example 2: Send Paid Invoice with Payment

```javascript
const invoiceData = {
  invoiceNumber: "LSE251009279",
  accountNumber: "6835021",
  client: {
    firstName: "Simon",
    lastName: "Gichu"
  },
  currency: { code: "KES" },
  items: [
    {
      description: "Monthly Rent",
      quantity: 1,
      unitPrice: 8000
    }
  ],
  totalAmount: 8000,
  amountPaid: 8000,
  issueDate: "2025-11-09T08:41:16.097Z",
  dueDate: "2025-12-04T21:00:00.000Z",
  status: "Paid",
  paymentDetails: {
    paymentStatus: "Completed",
    paymentMethod: "M-PESA",
    paymentDate: "2025-11-09T16:23:14.234Z",
    transactionId: "TJ96G6WZNE"
  }
};

const result = await sendInvoiceToZoho(invoiceData, {
  recordPayment: true,
  markAsSent: true
});
```

### Example 3: Bulk Send Invoices

```javascript
const { bulkSendInvoicesToZoho } = require('./services/integrations/zoho/send_invoice');

const invoices = [
  { /* invoice 1 */ },
  { /* invoice 2 */ },
  { /* invoice 3 */ }
];

const results = await bulkSendInvoicesToZoho(invoices, {
  skipIfExists: true,
  recordPayment: true,
  markAsSent: true
});

console.log(`Successful: ${results.successful}`);
console.log(`Failed: ${results.failed}`);
console.log(`Skipped: ${results.skipped}`);
```

### Example 4: Express Route Integration

```javascript
const express = require('express');
const { sendInvoiceToZoho } = require('./services/integrations/zoho/send_invoice');

const router = express.Router();

router.post('/invoices/:id/sync-to-zoho', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const result = await sendInvoiceToZoho(invoice.toJSON(), {
      skipIfExists: true,
      recordPayment: true,
      markAsSent: true
    });

    if (result.success) {
      // Update invoice with Zoho details
      invoice.zohoInvoiceId = result.data.invoice.id;
      invoice.zohoSyncedAt = new Date();
      await invoice.save();

      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## Error Handling

The integration provides comprehensive error handling:

### Error Response Format

```javascript
{
  success: false,
  message: "Error message",
  error: {
    code: "ERROR_CODE",
    message: "Detailed error message",
    details: { /* additional details */ }
  }
}
```

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `CONFIG_INVALID` | Missing configuration | Check `.env` file |
| `CREDENTIALS_INVALID` | Invalid OAuth credentials | Refresh access token |
| `CUSTOMER_FAILED` | Customer creation failed | Check customer data |
| `INVOICE_CREATE_FAILED` | Invoice creation failed | Check invoice data |
| `INVOICE_DATA_INVALID` | Invalid invoice data | Validate required fields |
| `TOKEN_REFRESH_FAILED` | Token refresh failed | Check client ID/secret |

### Handling Errors

```javascript
const result = await sendInvoiceToZoho(invoiceData);

if (!result.success) {
  console.error('Error:', result.message);

  if (result.error) {
    console.error('Code:', result.error.code);
    console.error('Details:', result.error.details);

    // Handle specific errors
    if (result.error.code === 'CREDENTIALS_INVALID') {
      // Refresh tokens or notify admin
    }
  }
}
```

---

## Troubleshooting

### Issue: "Invalid authentication" error

**Cause:** Access token expired
**Solution:** The token should auto-refresh. If not, manually refresh:

```bash
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=refresh_token"
```

Update the new `access_token` in your `.env` file.

### Issue: "Use zohoapis domain" error

**Cause:** Using old API domain
**Solution:** Ensure you're using `https://www.zohoapis.com/books/v3` not `https://books.zoho.com/api/v3`

### Issue: Invoice already exists

**Cause:** Duplicate invoice number
**Solution:** Set `skipIfExists: true` or use unique invoice numbers

### Issue: Customer not found

**Cause:** Customer doesn't exist in Zoho
**Solution:** The integration creates customers automatically. Ensure customer data is valid.

### Issue: Payment not recorded

**Cause:** Invoice status not "Paid"
**Solution:** Ensure `status: "Paid"` and `amountPaid > 0`

### Debug Mode

Enable detailed logging:

```javascript
// In config.js
enableLogging: true,
logLevel: 'debug'
```

Or set environment variable:

```bash
ZOHO_LOG_LEVEL=debug
```

---

## Best Practices

### 1. Token Management

- ✅ Store refresh token securely (never commit to git)
- ✅ Let the integration handle token refresh automatically
- ✅ Set up monitoring for token refresh failures

### 2. Error Handling

- ✅ Always check `result.success` before proceeding
- ✅ Log errors for debugging
- ✅ Implement retry logic for transient failures
- ✅ Notify admins of persistent failures

### 3. Data Validation

- ✅ Validate invoice data before sending
- ✅ Use unique invoice numbers
- ✅ Ensure dates are in correct format (ISO 8601)
- ✅ Verify customer information is complete

### 4. Performance

- ✅ Use bulk operations for multiple invoices
- ✅ Implement rate limiting if needed
- ✅ Cache customer IDs to avoid repeated lookups
- ✅ Run sync operations in background jobs

### 5. Testing

- ✅ Test with sample data first
- ✅ Use `skipIfExists: true` to prevent duplicates
- ✅ Verify invoices in Zoho Books dashboard
- ✅ Test payment recording with paid invoices

### 6. Monitoring

- ✅ Log all sync attempts
- ✅ Track success/failure rates
- ✅ Monitor API response times
- ✅ Set up alerts for failures

---

## File Structure

```
zoho/
├── config.js              # Configuration and environment variables
├── auth.js                # OAuth authentication and token management
├── customer.js            # Customer operations
├── invoice.js             # Invoice operations
├── payment.js             # Payment operations
├── utils.js               # Utility functions
├── send_invoice.js        # Main entry point
├── example.js             # Usage examples
├── routes.js              # Express routes (if needed)
└── README.md              # This file
```

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## Support

For issues or questions:

1. Check this README first
2. Review the [Zoho Books API Documentation](https://www.zoho.com/books/api/v3/)
3. Check the example file for common use cases
4. Open an issue in the repository

---

## License

[Your License Here]

---

## Changelog

### Version 1.0.0 (2025-10-22)

- ✅ Initial release
- ✅ Customer management (create/find)
- ✅ Invoice creation
- ✅ Payment recording
- ✅ Automatic token refresh
- ✅ Bulk operations
- ✅ Comprehensive error handling
- ✅ Full documentation

---

**Made with ❤️ for seamless Zoho Books integration**
