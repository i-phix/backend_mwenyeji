const axios = require('axios');
require('dotenv').config();
const { sendDirectSms } = require("../../../../../utils/send_new_sms");
const { sendDirectEmail } = require("../../../../../utils/send_new_email");
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const addCustomerAccount = async (request, reply) => {
    try {
        const accountData = request.body;

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.post(`${powerMeterServiceUrl}/add_customer_account`, accountData);

        // If account creation was successful, send notifications
        if (response.data && response.data.success !== false) {
            await sendPowerMeterNotifications(accountData);
        }

        return reply.code(201).send({
            message: 'Customer account created successfully',
            data: response.data.data || response.data
        });

    } catch (error) {
        console.error('Error forwarding add customer account request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to create customer account'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

// Function to send power meter notifications
async function sendPowerMeterNotifications(accountData) {
    try {
        const {
            facilityId,
            account_no,
            customerId,
            customerName,
            phoneNumber,
            email,
            meterNumber,
            unitId,
            payment_type
        } = accountData;

        // Skip if not prepaid or missing required fields
        if (payment_type !== 'Prepaid' || !phoneNumber || !email) {
            return;
        }

        let unitName = 'N/A';
        if (unitId && facilityId) {
            try {
                const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                const unit = await UnitModel.findById(unitId).lean();
                if (unit && unit.name) unitName = unit.name;
            } catch (unitError) {
                // Continue with default unit name
            }
        }

        // Get facility payment details and information
        const facilityPaymentDetailsModel = await getModel(
            'FacilityPaymentDetails',
            payservedb.FacilityPaymentDetails.schema,
            facilityId
        );

        const facilityPaymentDetails = await facilityPaymentDetailsModel.findOne({
            facility: facilityId,
            $or: [{ module: 'Power' }, { module: 'Electricity' }, { module: 'All' }]
        }).lean();

        const facilityDetails = await payservedb.Facility.findById(facilityId).lean();
        
        const paybillNumber = facilityPaymentDetails?.shortCode || 'Contact support for paybill';
        const facilityName = facilityDetails?.name || 'your facility';
        const supportContact = facilityDetails?.supportContact || '0709000505';
        const supportEmail = facilityDetails?.supportEmail || 'support@payserve.co.ke';

        // Clear SMS message for power meter
        const smsMessage = `Dear ${customerName}, you have been assigned a power meter for unit ${unitName} at ${facilityName}. Billing method is ${payment_type}, current balance: KES 0. To top up use Paybill ${paybillNumber}, and Account ${account_no}. For support contact ${supportContact}.`;

        // Email content for power meter
        const emailSubject = 'Power Meter Assignment and Instructions';
        const emailBody = `
            <h1>Power Meter Assignment</h1>
            <p>Dear ${customerName}, you have been assigned a power meter for unit ${unitName} at ${facilityName}.</p>
            <p><strong>Billing Method:</strong> ${payment_type}</p>
            <p><strong>Current Account Balance:</strong> KES 0</p>
            <p><strong>Meter Number:</strong> ${meterNumber}</p>
            <p><strong>Account Number:</strong> ${account_no}</p>
            
            <h2>Top-up Instructions</h2>
            <p>To top up your power meter, please use:</p>
            <p><strong>Paybill:</strong> ${paybillNumber}</p>
            <p><strong>Account Number:</strong> ${account_no}</p>
            
            <h2>Support Information</h2>
            <p>For any support issues, please contact:</p>
            <p><strong>Email:</strong> ${supportEmail}</p>
            <p><strong>Phone:</strong> ${supportContact}</p>
        `;

        // Send single email and single SMS
        await sendDirectEmail(
            facilityId,
            email,
            emailSubject,
            smsMessage, // Plain text version for email
            emailBody,
            facilityName
        );

        await sendDirectSms(facilityId, phoneNumber, smsMessage);

        console.log('Power meter notifications sent successfully', {
            customerId,
            facilityId,
            payment_type,
            phoneNumber,
            email
        });

    } catch (communicationError) {
        console.error('Failed to send power meter notifications:', {
            error: communicationError.message,
            accountData: {
                customerId: accountData.customerId,
                facilityId: accountData.facilityId,
                payment_type: accountData.payment_type
            }
        });
        // Don't fail the entire operation just because communications failed
    }
}

module.exports = addCustomerAccount;