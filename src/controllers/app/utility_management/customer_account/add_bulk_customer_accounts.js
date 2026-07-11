const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');
// const { sendDirectSms } = require("../../../../utils/send_new_sms");
// const { sendDirectEmail } = require("../../../../utils/send_new_email");

class PayServeAccountManager {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000;
  }

  async addAccountDetails(accountNumber, facilityId, customerId, accountType = null, amount = null) {
    const payload = { accountNumber, facilityId, customerId };
    let attempt = 1;
    let lastError = null;

    while (attempt <= this.MAX_RETRIES) {
      try {
        const response = await fetch('https://sandbox.payments.payserve.co.ke/v1/addAccount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let parsedError;
          try { parsedError = JSON.parse(errorBody); } catch (e) { parsedError = { message: errorBody }; }

          if (parsedError.message === 'Account already exists') {
            return { success: true, message: 'Account already exists', accountNumber };
          }

          throw new Error(`PayServe API responded with status ${response.status}: ${errorBody}`);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === this.MAX_RETRIES) break;
        
        const backoffDelay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        attempt++;
      }
    }
    throw new Error(`Failed to add account details after ${this.MAX_RETRIES} attempts: ${lastError.message}`);
  }
}

const importCustomerAccounts = async (request, reply) => {
  const payServeAccountManager = new PayServeAccountManager();
  
  try {
    console.log('=== Import Customer Accounts Started ===');
    console.log('Request method:', request.method);
    console.log('Request params:', request.params);
    console.log('Request file:', request.file);
    console.log('Request body:', request.body);
    
    const { facilityId } = request.params;

    if (!facilityId) {
      console.error('No facility ID provided');
      return reply.code(400).send({ error: 'Facility ID is required' });
    }

    // Access the file uploaded by multer
    const file = request.file;
    console.log('File received:', file ? file.originalname : 'NO FILE');
    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Check file extension
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (fileExt !== '.csv') {
      fs.unlinkSync(file.path);
      return reply.code(400).send({ error: 'Only CSV files are allowed' });
    }

    // Parse CSV file
    const fileContent = fs.readFileSync(file.path, 'utf8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // Get models
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
    const WaterMeterModel = await utilityDb.getModel('WaterMeter');
    const CustomerModel = payservedb.Customer;
    const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // Process results
    const results = {
      success: 0,
      skipped: 0,
      errors: []
    };

    for (const record of records) {
      try {
        // Validate required fields from CSV
        const { meterNumber, customerName, phoneNumber, payment_type } = record;
        const email = record.email || '';

        if (!meterNumber || !customerName || !phoneNumber || !payment_type) {
          results.errors.push({
            row: record,
            error: 'Missing required fields (meterNumber, customerName, phoneNumber, or payment_type)'
          });
          continue;
        }

        // Validate payment_type
        if (!['Prepaid', 'Postpaid'].includes(payment_type)) {
          results.errors.push({
            row: record,
            error: 'payment_type must be either "Prepaid" or "Postpaid"'
          });
          continue;
        }

        // Find the meter in utility database
        const meter = await WaterMeterModel.findOne({
          meterNumber: meterNumber.trim(),
          facilityId
        });

        if (!meter) {
          results.errors.push({
            row: record,
            error: `Meter with number ${meterNumber} not found in facility`
          });
          continue;
        }

        // Check if account already exists for this meter
        const existingMeterAccount = await WaterMeterAccountModel.findOne({
          meterNumber: meterNumber.trim(),
          facilityId,
          status: 'Active'
        });

        if (existingMeterAccount) {
          results.errors.push({
            row: record,
            error: `An active account already exists for meter number ${meterNumber}`
          });
          results.skipped++;
          continue;
        }

        // Get account number from meter
        const accountNumber = meter.accountNumber;
        if (!accountNumber) {
          results.errors.push({
            row: record,
            error: `Meter ${meterNumber} is missing account number`
          });
          continue;
        }

        // Find or create customer
        let customerId;
        let customerEmail = email || '';
        let finalCustomerName = customerName.trim();

        try {
          // First, try to find customer in Customer collection by phone number
          let customer = await CustomerModel.findOne({
            phoneNumber: phoneNumber.trim(),
            facilityId
          });

          if (customer) {
            // Customer exists in Customer collection
            customerId = customer._id;
            customerEmail = customer.email || email || '';
            finalCustomerName = `${customer.firstName} ${customer.lastName}`.trim();
          } else {
            // Customer not found in Customer collection, check User collection
            const UserModel = payservedb.User;
            let user = null;
            
            try {
              user = await UserModel.findOne({
                phoneNumber: phoneNumber.trim()
              });
            } catch (userErr) {
              console.log('User lookup failed:', userErr.message);
            }

            if (user) {
              // User exists, create Customer record from User data
              const nameParts = user.fullName.trim().split(' ');
              const firstName = nameParts[0] || user.fullName;
              const lastName = nameParts.slice(1).join(' ') || user.fullName;

              // Get the last customer number to generate a new one
              const lastCustomer = await CustomerModel.findOne({ facilityId }).sort({ customerNumber: -1 }).limit(1);
              const newCustomerNumber = lastCustomer ? lastCustomer.customerNumber + 1 : 1;

              const newCustomer = new CustomerModel({
                customerNumber: newCustomerNumber,
                firstName,
                lastName,
                phoneNumber: user.phoneNumber,
                idNumber: user.idNumber || `ID-${Date.now()}`,
                email: user.email || email || `customer${newCustomerNumber}@temp.com`,
                customerType: 'resident',
                residentType: 'resident',
                facilityId,
                status: 'Active'
              });

              const savedCustomer = await newCustomer.save();
              customerId = savedCustomer._id;
              customerEmail = savedCustomer.email;
              finalCustomerName = user.fullName;
            } else {
              // Neither Customer nor User exists, create new Customer from CSV data
              const nameParts = customerName.trim().split(' ');
              const firstName = nameParts[0] || customerName;
              const lastName = nameParts.slice(1).join(' ') || customerName;

              // Get the last customer number to generate a new one
              const lastCustomer = await CustomerModel.findOne({ facilityId }).sort({ customerNumber: -1 }).limit(1);
              const newCustomerNumber = lastCustomer ? lastCustomer.customerNumber + 1 : 1;

              const newCustomer = new CustomerModel({
                customerNumber: newCustomerNumber,
                firstName,
                lastName,
                phoneNumber: phoneNumber.trim(),
                idNumber: `ID-${Date.now()}`,
                email: email || `customer${newCustomerNumber}@temp.com`,
                customerType: 'resident',
                residentType: 'resident',
                facilityId,
                status: 'Active'
              });

              const savedCustomer = await newCustomer.save();
              customerId = savedCustomer._id;
              customerEmail = savedCustomer.email;
            }
          }

          // Update meter with customer information
          meter.customerId = customerId;
          meter.customerType = payment_type.toLowerCase();
          await meter.save();

        } catch (customerError) {
          results.errors.push({
            row: record,
            error: `Customer processing error: ${customerError.message}`
          });
          continue;
        }

        // Get readings and other info from meter
        const previousReading = meter.previousReading || 0;
        const currentReading = meter.currentReading || 0;

        // Get unit information from meter
        let unitId = meter.unitId;
        let unitName = 'N/A';

        if (unitId) {
          try {
            const unit = await UnitModel.findById(unitId).lean();
            if (unit && unit.name) {
              unitName = unit.name;
            }
          } catch (unitError) {
            console.warn('Error fetching unit:', unitError.message);
          }
        }

        // Normalize payment_type to match schema enum
        const normalizedPaymentType = payment_type.charAt(0).toUpperCase() + payment_type.slice(1).toLowerCase();

        // Create the water meter account using the meter's account number
        const utilityAccount = new WaterMeterAccountModel({
          facilityId,
          account_no: accountNumber,
          customerId,
          customerName: finalCustomerName,
          phoneNumber: phoneNumber.trim(),
          email: customerEmail,
          meterNumber: meterNumber.trim(),
          unitId: unitId || null,
          unitName,
          payment_type: normalizedPaymentType,
          previousReading,
          currentReading,
          status: 'Active',
          meter_id: meter._id,
          payServeSync: false,
          accountBalance: 0,
          created_on: new Date()
        });

        const savedAccount = await utilityAccount.save();

        // Sync to PayServe using the meter's account number
        try {
          await payServeAccountManager.addAccountDetails(
            accountNumber,
            facilityId,
            customerId,
            normalizedPaymentType,
            0
          );
          savedAccount.payServeSync = true;
          await savedAccount.save();
        } catch (payServeError) {
          console.error('PayServe sync error:', payServeError.message);
          savedAccount.payServeSync = false;
          await savedAccount.save();
        }

        // Send SMS and Email (COMMENTED OUT FOR NOW - WILL USE LATER)
        /*
        if (normalizedPaymentType === 'Prepaid') {
          try {
            const facilityPaymentDetailsModel = await getModel(
              'FacilityPaymentDetails',
              payservedb.FacilityPaymentDetails.schema,
              facilityId
            );

            const facilityPaymentDetails = await facilityPaymentDetailsModel.findOne({
              facility: facilityId,
              $or: [{ module: 'Water' }, { module: 'All' }]
            }).lean();

            const facilityDetails = await payservedb.Facility.findById(facilityId).lean();
            
            const paybillNumber = facilityPaymentDetails?.shortCode || 'Contact support for paybill';
            const facilityName = facilityDetails?.name || 'your facility';
            const supportContact = facilityDetails?.supportContact || '0709000505';
            const supportEmail = facilityDetails?.supportEmail || 'support@payserve.co.ke';

            const smsMessage = `Dear ${finalCustomerName}, you have been assigned a water meter for unit ${unitName} at ${facilityName}. Billing method is ${normalizedPaymentType}, current balance: KES 0. To top up use Paybill ${paybillNumber}, and Account ${accountNumber}. For support contact ${supportContact}.`;

            const emailSubject = 'Water Meter Assignment and Instructions';
            const emailBody = `
              <h1>Water Meter Assignment</h1>
              <p>Dear ${finalCustomerName}, you have been assigned a water meter for unit ${unitName} at ${facilityName}.</p>
              <p><strong>Billing Method:</strong> ${normalizedPaymentType}</p>
              <p><strong>Current Account Balance:</strong> KES 0</p>
              
              <h2>Top-up Instructions</h2>
              <p>To top up your water meter, please use:</p>
              <p><strong>Paybill:</strong> ${paybillNumber}</p>
              <p><strong>Account Number:</strong> ${accountNumber}</p>
              
              <h2>Support Information</h2>
              <p>For any support issues, please contact:</p>
              <p><strong>Email:</strong> ${supportEmail}</p>
              <p><strong>Phone:</strong> ${supportContact}</p>
            `;

            await sendDirectEmail(
              facilityId,
              customerEmail,
              emailSubject,
              smsMessage,
              emailBody,
              facilityName
            );

            await sendDirectSms(facilityId, phoneNumber.trim(), smsMessage);

          } catch (communicationError) {
            console.error('Communication error:', communicationError.message);
          }
        }
        */

        results.success++;

      } catch (error) {
        results.errors.push({
          row: record,
          error: error.message
        });
      }
    }

    // Clean up the temporary file
    fs.unlinkSync(file.path);

    const totalProcessed = results.success + results.updated;

    // Return response similar to working examples
    return reply.code(200).send({
      success: true,
      message: totalProcessed > 0 
        ? `Import completed: ${results.success} created, ${results.skipped} skipped, ${results.errors.length} errors`
        : 'No records processed',
      results: {
        total: records.length,
        successful: results.success,
        skipped: results.skipped,
        failed: results.errors.length,
        errors: results.errors
      }
    });

  } catch (err) {
    console.error('=== Import Error ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Error details:', err);
    
    // Clean up file if it exists
    if (request.file && request.file.path) {
      try {
        fs.unlinkSync(request.file.path);
      } catch (unlinkErr) {
        console.error('File cleanup error:', unlinkErr);
      }
    }

    return reply.code(500).send({
      success: false,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

module.exports = importCustomerAccounts;