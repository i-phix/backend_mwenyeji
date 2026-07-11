// resendOnboardingController.js
const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const { sendDirectSms } = require("../../../../utils/send_new_sms");
const { sendDirectEmail } = require("../../../../utils/send_new_email");
const { sendWhatsappMessage } = require("../../../../utils/send_whatsapp");

const resendOnboardingController = async (request, reply) => {
  try {
    const { 
      accountId,
      accountNumber,
      customerName,
      meterNumber,
      facilityId,
      email,
      phoneNumber,
      paymentType,
      unitName 
    } = request.body;

    // Validate required fields
    if (!accountId && !accountNumber) {
      throw new Error('Account ID or Account Number is required');
    }

    if (!facilityId) {
      throw new Error('Facility ID is required');
    }

    if (!email && !phoneNumber) {
      throw new Error('At least one contact method (email or phone) is required');
    }

    // Get the WaterMeterAccount model
    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

    // Find the account by ID or account number
    let account;
    if (accountId) {
      account = await WaterMeterAccountModel.findById(accountId);
    } else {
      account = await WaterMeterAccountModel.findOne({
        account_no: accountNumber,
        facilityId
      });
    }

    if (!account) {
      throw new Error('Account not found');
    }

    // Use provided data or fall back to account data
    const customerNameToUse = customerName || account.customerName;
    const meterNumberToUse = meterNumber || account.meterNumber;
    const emailToUse = email || account.email;
    const phoneNumberToUse = phoneNumber || account.phoneNumber;
    const paymentTypeToUse = paymentType || account.payment_type;
    const unitNameToUse = unitName || account.unitName;

    // Get facility payment details
    const facilityPaymentDetailsModel = await getModel(
      'FacilityPaymentDetails',
      payservedb.FacilityPaymentDetails.schema,
      facilityId
    );

    const facilityPaymentDetails = await facilityPaymentDetailsModel.findOne({
      facility: facilityId,
      $or: [{ module: 'Water' }, { module: 'All' }]
    }).lean();

    // Get facility details
    const facilityDetails = await payservedb.Facility.findById(facilityId).lean();
    
    const paybillNumber = facilityPaymentDetails?.shortCode || 'Contact support for paybill';
    const facilityName = facilityDetails?.name || 'your facility';
    const supportContact = facilityDetails?.supportContact || '0709000505';
    const supportEmail = facilityDetails?.supportEmail || 'support@payserve.co.ke';

    // SMS message template
    const smsMessage = `Dear ${customerNameToUse}, you have been assigned a water meter for unit ${unitNameToUse} at ${facilityName}. Billing method is ${paymentTypeToUse}, current balance: KES 0. To top up use Paybill ${paybillNumber}, and Account ${account.account_no}. For support contact ${supportContact}.`;

    // Email content
    const emailSubject = 'Water Meter Assignment and Instructions';
    const emailBody = `
      <h1>Water Meter Assignment</h1>
      <p>Dear ${customerNameToUse}, you have been assigned a water meter for unit ${unitNameToUse} at ${facilityName}.</p>
      <p><strong>Billing Method:</strong> ${paymentTypeToUse}</p>
      <p><strong>Current Account Balance:</strong> KES 0</p>
      
      <h2>Top-up Instructions</h2>
      <p>To top up your water meter, please use:</p>
      <p><strong>Paybill:</strong> ${paybillNumber}</p>
      <p><strong>Account Number:</strong> ${account.account_no}</p>
      <p><strong>Meter Number:</strong> ${meterNumberToUse}</p>
      
      <h2>Support Information</h2>
      <p>For any support issues, please contact:</p>
      <p><strong>Email:</strong> ${supportEmail}</p>
      <p><strong>Phone:</strong> ${supportContact}</p>
      
      <p><em>This is a re-send of your onboarding information. If you have already received this, please disregard this message.</em></p>
    `;

    // Send communications
    const results = {
      emailSent: false,
      smsSent: false,
      accountUpdated: false
    };

    // Update account contact info if provided
    const updateData = {};
    if (email && email !== account.email) {
      updateData.email = email;
    }
    if (phoneNumber && phoneNumber !== account.phoneNumber) {
      updateData.phoneNumber = phoneNumber;
    }

    if (Object.keys(updateData).length > 0) {
      await WaterMeterAccountModel.findByIdAndUpdate(account._id, updateData);
      results.accountUpdated = true;
    }

    // Send email
    if (emailToUse) {
      try {
        await sendDirectEmail(
          facilityId,
          emailToUse,
          emailSubject,
          smsMessage, // Plain text version for email
          emailBody,
          facilityName
        );
        results.emailSent = true;
      } catch (emailError) {
        console.error('Failed to send onboarding email:', emailError.message);
      }
    }

    // Send SMS
    if (phoneNumberToUse) {
      try {
        await sendDirectSms(facilityId, phoneNumberToUse, smsMessage);
        results.smsSent = true;
      } catch (smsError) {
        console.error('Failed to send onboarding SMS:', smsError.message);
      }
      // Best-effort: also fire WhatsApp via cops Green API (controlled by UTILITY_WHATSAPP_ENABLED)
      sendWhatsappMessage(phoneNumberToUse, smsMessage, {
        contactName: customerName,
        source: 'water-onboarding-resend'
      }).catch(() => {});
    }

    // Check if any communication was sent
    if (!results.emailSent && !results.smsSent) {
      throw new Error('Failed to send both email and SMS. Please check the contact information.');
    }

    return reply.code(200).send({
      success: true,
      message: 'Onboarding information sent successfully',
      data: {
        accountId: account._id,
        accountNumber: account.account_no,
        customerName: customerNameToUse,
        communicationsSent: results,
        contactInfo: {
          email: emailToUse,
          phoneNumber: phoneNumberToUse
        }
      }
    });

  } catch (err) {
    console.error('Error in resendOnboardingController:', err);
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

// Additional controller to update contact information
const updateAccountContactController = async (request, reply) => {
  try {
    const { accountId, email, phoneNumber } = request.body;

    if (!accountId) {
      throw new Error('Account ID is required');
    }

    if (!email && !phoneNumber) {
      throw new Error('At least one contact method (email or phone) is required');
    }

    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
    const account = await WaterMeterAccountModel.findById(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    const updateData = {};
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    const updatedAccount = await WaterMeterAccountModel.findByIdAndUpdate(
      accountId,
      updateData,
      { new: true, runValidators: true }
    );

    return reply.code(200).send({
      success: true,
      message: 'Contact information updated successfully',
      data: {
        accountId: updatedAccount._id,
        accountNumber: updatedAccount.account_no,
        email: updatedAccount.email,
        phoneNumber: updatedAccount.phoneNumber
      }
    });

  } catch (err) {
    console.error('Error in updateAccountContactController:', err);
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = {
  resendOnboardingController,
  updateAccountContactController
};