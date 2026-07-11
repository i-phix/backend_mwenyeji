const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const { sendSms } = require("../../../../utils/send_new_sms");
const { sendEmail } = require("../../../../utils/send_new_email");
const { sendUtilityNotification } = require("../../../../utils/send_utility_notification");

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

const createUserAccount = async (request, reply) => {
  const payServeAccountManager = new PayServeAccountManager();
  try {
    const { facilityId, account_no, customerId, customerName, phoneNumber, email, meterNumber, unitId, payment_type, previousReading, currentReading, meter_id } = request.body;

    if (!facilityId) throw new Error('Facility ID is required');
    if (!account_no) throw new Error('Account number is required');
    if (!customerId) throw new Error('Customer ID is required');
    if (!meter_id) throw new Error('Meter ID is required');
    if (!meterNumber) throw new Error('Meter number is required');

    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

    const existingMeterAccount = await WaterMeterAccountModel.findOne({
      meterNumber,
      facilityId,
      status: 'Active'
    });

    if (existingMeterAccount) {
      throw new Error(`An active account already exists for meter number ${meterNumber}. Only one active account per meter is allowed.`);
    }

    const customerMeterAccount = await WaterMeterAccountModel.findOne({
      customerId,
      meter_id,
      facilityId
    });

    if (customerMeterAccount) {
      const msg = customerMeterAccount.status === 'Inactive'
        ? 'User account exists but is inactive. Please activate.'
        : 'User account for this customer and meter already exists.';
      throw new Error(msg);
    }

    // GET UNIT NAME FROM UNIT SCHEMA
    let unitName = 'N/A';
    if (unitId) {
      try {
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const unit = await UnitModel.findById(unitId).lean();
        if (unit && unit.name) unitName = unit.name;
      } catch (unitError) {
        console.error('Error fetching unit name:', unitError.message);
        // Continue with default unit name if there's an error
      }
    }

    // CREATE ACCOUNT WITH UNIT NAME
    const utilityAccount = new WaterMeterAccountModel({
      facilityId,
      account_no,
      customerId,
      customerName,
      phoneNumber,
      email,
      meterNumber,
      unitId,
      unitName: unitName,
      payment_type,
      previousReading: previousReading || 0,
      currentReading,
      status: 'Active',
      meter_id,
      payServeSync: false,
      createdAt: new Date()
    });
    
    const savedAccount = await utilityAccount.save();

    try {
      await payServeAccountManager.addAccountDetails(account_no, facilityId, customerId, payment_type, 0);
      savedAccount.payServeSync = true;
      await savedAccount.save();
    } catch (payServeError) {
      savedAccount.payServeSync = false;
      await savedAccount.save();
    }
    
    if (payment_type === 'Prepaid') {
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
        
        const paybillNumber = facilityPaymentDetails?.shortCode || 'Contact support';
        const facilityName = facilityDetails?.name || 'Your facility';
        const supportContact = facilityDetails?.supportContact || '+254709000505';
        const supportEmail = facilityDetails?.supportEmail || 'support@payserve.co.ke';

        // Updated SMS message format
        const smsMessage = `Welcome ${customerName}. Your water meter at ${facilityName} (${unitName}) has been successfully assigned. To activate the meter, please top up via Paybill ${paybillNumber}, Account ${account_no}. Current Balance: KES 0. For assistance contact: ${supportContact}. Managed by PayServe Kenya.`;

        // Updated Email content
        const emailSubject = 'Water Meter Successfully Assigned';
        const emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Welcome ${customerName}</h2>
            
            <p>Your water meter at <strong>${facilityName} (${unitName})</strong> has been successfully assigned.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #2c3e50; margin-top: 0;">Meter Activation</h3>
              <p>To activate your meter, please top up using:</p>
              <p><strong>Paybill:</strong> ${paybillNumber}<br>
              <strong>Account Number:</strong> ${account_no}</p>
              <p><strong>Current Balance:</strong> KES 0</p>
            </div>
            
            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #2c3e50; margin-top: 0;">Need Assistance?</h3>
              <p><strong>Phone:</strong> ${supportContact}<br>
              <strong>Email:</strong> ${supportEmail}</p>
            </div>
            
            <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">Managed by PayServe Kenya</p>
          </div>
        `;

        // Send email and SMS
        await sendEmail(
          facilityId,
          email,
          emailSubject,
          smsMessage, // Plain text version for email
          emailBody,
          facilityName
        );

        await sendUtilityNotification(facilityId, phoneNumber, smsMessage, { source: 'water-onboarding' });

      } catch (communicationError) {
        console.error('Communication error:', communicationError.message);
        // Don't fail the entire operation just because communications failed
      }
    }

    return reply.code(200).send({
      success: true,
      message: 'User account created successfully',
      data: savedAccount
    });
  } catch (err) {
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = createUserAccount;