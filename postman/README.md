# Zoho Books Integration - Postman Collection

Complete API collection for testing and using the Zoho Books integration endpoints.

---

## 📥 Import Collection

### Method 1: Import JSON File
1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `Zoho_Books_Integration.postman_collection.json`
5. Click **Import**

### Method 2: Drag and Drop
1. Open Postman
2. Drag `Zoho_Books_Integration.postman_collection.json` into Postman window
3. Collection will be imported automatically

---

## 🚀 Quick Start

### Step 1: Set Base URL Variable

The collection uses `{{base_url}}` variable. To set it:

1. Click on the collection name in Postman
2. Go to **Variables** tab
3. Set `base_url` to your server URL (default: `http://localhost:3000`)
4. Click **Save**

### Step 2: Start Your Server

```bash
cd backend_main
npm start
```

### Step 3: Test Connection

Run the **"Test Connection"** request in the **"1. Connection & Health"** folder.

Expected response:
```json
{
  "success": true,
  "message": "Successfully connected to Zoho Books"
}
```

---

## 📚 Collection Structure

### 1. Connection & Health
- Test Connection
- Validate Credentials

### 2. Invoice Operations
- Send Single Invoice
- Send Bulk Invoices
- Get Invoice Status (by number or ID)
- Mark Invoice as Sent
- Mark Invoice as Paid

### 3. Payment Operations
- Add Payment to Invoice
- Add Multiple Payments (Installments)
- Get Invoice Payments
- Get Payment History
- Update Payment
- Delete Payment
- Get Payment Modes
- Record Payment (Legacy)

### 4. Customer Operations
- Get Customer by ID
- Get Customer by Name

### 5. Token Management
- Get Token Status
- Refresh Token

---

## 🎯 Sample Invoices Available

The collection includes sample invoice numbers from your Zoho Books:

| Invoice Number | Description | Amount | Due Date |
|----------------|-------------|--------|----------|
| `BULK17615597683783` | Unit 3 | KES 3,480.00 | 26/11/2025 |
| `BULK17615597683782` | Unit 2 | KES 2,320.00 | 26/11/2025 |
| `BULK17615597683781` | Unit 1 | KES 1,160.00 | 26/11/2025 |
| `IDEMPOTENT1761559761521` | Test Invoice | KES 5,800.00 | 26/11/2025 |
| `TEST1761559757906` | Test Invoice | - | 26/11/2025 |

---

## 💡 Common Workflows

### Workflow 1: Check Invoice and Add Payment

#### Step 1: Get Invoice Status
**Request:** `GET Invoice Status by Number`
- Replace invoice number: `BULK17615597683783`
- Click **Send**

**Response Example:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_id": "7253014000000113050",
      "customer_id": "7253014000000113002",
      "invoice_number": "BULK17615597683783",
      "total": 3480,
      "balance": 3480,
      "status": "sent"
    }
  }
}
```

#### Step 2: Copy IDs
From the response, copy:
- `invoice_id` → Use in payment request
- `customer_id` → Use in payment request

#### Step 3: Add Payment
**Request:** `Add Payment to Invoice`

Update the body:
```json
{
  "invoiceId": "7253014000000113050",
  "customerId": "7253014000000113002",
  "amount": 1000,
  "paymentDate": "2025-10-27",
  "paymentMode": "mpesa",
  "referenceNumber": "TJ96G6WZNE",
  "description": "Partial payment via M-Pesa"
}
```

#### Step 4: Verify Payment
**Request:** `Get Payment History`
- Use the `invoice_id` from step 1
- Click **Send**

---

### Workflow 2: Create New Invoice

**Request:** `Send Single Invoice`

Modify the body:
```json
{
  "invoiceData": {
    "invoiceNumber": "TEST-NEW-001",
    "accountNumber": "ACC-001",
    "client": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254712345678"
    },
    "facility": {
      "name": "Test Facility"
    },
    "unit": {
      "name": "Unit 1A"
    },
    "currency": {
      "code": "KES"
    },
    "items": [
      {
        "description": "Monthly Rent",
        "quantity": 1,
        "unitPrice": 50000
      }
    ],
    "totalAmount": 50000,
    "amountPaid": 0,
    "issueDate": "2025-10-27T00:00:00.000Z",
    "dueDate": "2025-11-27T00:00:00.000Z",
    "status": "Unpaid"
  },
  "options": {
    "skipIfExists": true,
    "recordPayment": false,
    "markAsSent": true
  }
}
```

---

### Workflow 3: Record Multiple Installment Payments

**Request:** `Add Multiple Payments (Installments)`

```json
{
  "invoiceId": "7253014000000113050",
  "customerId": "7253014000000113002",
  "payments": [
    {
      "amount": 1000,
      "paymentDate": "2025-10-15",
      "paymentMode": "mpesa",
      "referenceNumber": "MP-OCT15-001",
      "description": "First installment"
    },
    {
      "amount": 1500,
      "paymentDate": "2025-10-20",
      "paymentMode": "mpesa",
      "referenceNumber": "MP-OCT20-001",
      "description": "Second installment"
    },
    {
      "amount": 980,
      "paymentDate": "2025-10-25",
      "paymentMode": "bank_transfer",
      "referenceNumber": "BT-OCT25-001",
      "description": "Final payment"
    }
  ]
}
```

---

## 🔧 Using Collection Variables

### Available Variables

- `{{base_url}}` - API server URL
- `{{unit3_invoice_id}}` - Invoice ID for Unit 3
- `{{unit3_customer_id}}` - Customer ID for Unit 3
- `{{unit2_invoice_id}}` - Invoice ID for Unit 2
- `{{unit2_customer_id}}` - Customer ID for Unit 2
- `{{unit1_invoice_id}}` - Invoice ID for Unit 1
- `{{unit1_customer_id}}` - Customer ID for Unit 1

### How to Set Variables

1. Click on collection name
2. Go to **Variables** tab
3. Update **Current Value** column
4. Click **Save**

### Using Variables in Requests

Variables are referenced as `{{variable_name}}`:

```json
{
  "invoiceId": "{{unit3_invoice_id}}",
  "customerId": "{{unit3_customer_id}}",
  "amount": 1000
}
```

---

## 📖 Request Details

### Payment Modes

Available payment modes:
- `mpesa` - M-Pesa mobile money
- `bank_transfer` - Direct bank transfer
- `cash` - Cash payment
- `creditcard` - Credit/debit card
- `check` - Cheque payment
- `paypal` - PayPal
- `stripe` - Stripe
- `other` - Other payment method

### Date Format

All dates should be in **YYYY-MM-DD** format:
```
2025-10-27
```

Or ISO 8601 format:
```
2025-10-27T00:00:00.000Z
```

### Amount Format

Amounts should be numbers (not strings):
```json
{
  "amount": 1000
}
```

Not:
```json
{
  "amount": "1000"
}
```

---

## 🎯 Testing Scenarios

### Scenario 1: Partial Payment Flow

1. **Get Invoice Status** → `BULK17615597683783` (KES 3,480)
2. **Add Payment** → KES 1,000 (M-Pesa)
3. **Get Payment History** → Verify partial payment
4. **Add Payment** → KES 2,480 (Bank Transfer)
5. **Get Payment History** → Verify full payment

### Scenario 2: Full Payment

1. **Get Invoice Status** → `BULK17615597683781` (KES 1,160)
2. **Add Payment** → KES 1,160 (Cash)
3. **Get Invoice Status** → Confirm status is "paid"

### Scenario 3: Create and Pay Invoice

1. **Send Single Invoice** → Create new invoice
2. **Get Invoice Status** → Get invoice and customer IDs
3. **Add Payment** → Record payment
4. **Get Payment History** → View payment details

---

## ⚠️ Common Issues

### Issue 1: Connection Refused

**Error:**
```json
{
  "error": "connect ECONNREFUSED ::1:3000"
}
```

**Solution:**
- Make sure server is running: `npm start`
- Check `base_url` variable is correct
- Verify port number (default: 3000)

### Issue 2: Invoice Not Found

**Error:**
```json
{
  "success": false,
  "error": "Invoice not found"
}
```

**Solution:**
- Verify invoice number is correct
- Try with `type=number` query parameter
- Check invoice exists in Zoho Books

### Issue 3: Payment Exceeds Balance

**Error:**
```json
{
  "success": false,
  "error": "Payment amount exceeds invoice balance"
}
```

**Solution:**
1. First get invoice status to check balance
2. Ensure payment amount ≤ current balance
3. Adjust payment amount accordingly

### Issue 4: Invalid Date Format

**Error:**
```json
{
  "success": false,
  "error": "Invalid payment date format"
}
```

**Solution:**
Use format: `YYYY-MM-DD`
```json
{
  "paymentDate": "2025-10-27"
}
```

---

## 🔍 Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid request data |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Internal server error |
| 503 | Service Unavailable | Zoho Books connection failed |

---

## 💡 Pro Tips

### Tip 1: Save Responses
Right-click on request → **Save Response** → **Save as Example**

### Tip 2: Use Tests Tab
Add automatic checks in the **Tests** tab:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
});
```

### Tip 3: Use Environments
Create different environments for development, staging, and production:
1. Click **Environments** (left sidebar)
2. Create new environment
3. Set `base_url` variable
4. Switch environments as needed

### Tip 4: Export Variables
After getting invoice IDs, save them as variables:

**Tests tab:**
```javascript
var response = pm.response.json();
if (response.success) {
    pm.collectionVariables.set("invoice_id", response.data.invoice.id);
    pm.collectionVariables.set("customer_id", response.data.invoice.customerId);
}
```

---

## 📝 Quick Reference

### Get Invoice
```
GET {{base_url}}/api/integrations/zoho/invoices/BULK17615597683783/status?type=number
```

### Add Payment
```
POST {{base_url}}/api/integrations/zoho/payments/add
Body: { invoiceId, customerId, amount, paymentDate, paymentMode, referenceNumber }
```

### Get Payment History
```
GET {{base_url}}/api/integrations/zoho/invoices/:invoiceId/payment-history
```

### Get Payment Modes
```
GET {{base_url}}/api/integrations/zoho/payments/modes
```

---

## 📚 Additional Resources

- **Full API Documentation:** `../src/controllers/integrations/zoho/PAYMENT_GUIDE.md`
- **Quick Reference:** `../PAYMENT_QUICK_REF.md`
- **NPM Scripts Guide:** `../scripts/ZOHO_SCRIPTS_README.md`

---

## 🆘 Need Help?

1. Check the **Console** tab in Postman for detailed error messages
2. Review request/response in **Body** and **Headers** tabs
3. Test connection first: **Test Connection** request
4. Verify server is running at `{{base_url}}`
5. Check invoice numbers are correct

---

**Version:** 1.0.0
**Last Updated:** 2025-10-28
**Status:** ✅ Production Ready
