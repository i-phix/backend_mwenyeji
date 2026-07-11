const { sendSms } = require('./src/utils/send_new_sms');
const { sendEmail } = require('./src/utils/send_new_email');
require('dotenv').config();

async function testCommunications() {
    console.log('\n========================================');
    console.log('TESTING SMS AND EMAIL FUNCTIONALITY');
    console.log('========================================\n');

    const testPhone = '0720538053';
    const testEmail = 'mesandyelaine@gmail.com';
    const facilityId = process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;

    console.log('Configuration:');
    console.log('- Test Phone:', testPhone);
    console.log('- Test Email:', testEmail);
    console.log('- Facility ID:', facilityId);
    console.log('- Backend URL:', process.env.BACKEND_URL);
    console.log('- Communications Endpoint:', process.env.COMMUNICATIONS_ENDPOINT);
    console.log('\n');

    // Test SMS
    console.log('========================================');
    console.log('TEST 1: SENDING SMS');
    console.log('========================================\n');

    const smsMessage = `PayServe Test SMS

This is a test message from the Customer Obsession Portal.

Agent credentials have been successfully configured.

Test Date: ${new Date().toLocaleString()}

- PayServe Team`;

    try {
        console.log('Sending SMS to:', testPhone);
        console.log('Message:', smsMessage);
        console.log('\n');

        const smsResult = await sendSms(facilityId, testPhone, smsMessage);

        console.log('\n✅ SMS SENT SUCCESSFULLY!');
        console.log('Result:', JSON.stringify(smsResult, null, 2));
    } catch (smsError) {
        console.error('\n❌ SMS FAILED!');
        console.error('Error:', smsError.message);
        if (smsError.response) {
            console.error('Response Status:', smsError.response.status);
            console.error('Response Data:', smsError.response.data);
        }
    }

    console.log('\n');

    // Test Email
    console.log('========================================');
    console.log('TEST 2: SENDING EMAIL');
    console.log('========================================\n');

    const emailSubject = 'PayServe Customer Obsession Portal - Test Email';
    const emailMessage = `Dear User,

This is a test email from the PayServe Customer Obsession Portal.

Your agent credentials have been successfully configured and the email system is working correctly.

Test Details:
- Date: ${new Date().toLocaleString()}
- System: Customer Obsession Portal
- Purpose: Verify email delivery functionality

Features Implemented:
✅ Agent Management
✅ Ticket System with SLA
✅ Auto-Escalation
✅ Comprehensive Audit Logs
✅ SMS & Email Notifications

If you received this email, the notification system is working perfectly!

Best regards,
PayServe Customer Obsession Team

---
This is an automated test message from PayServe Customer Obsession Portal.`;

    try {
        console.log('Sending Email to:', testEmail);
        console.log('Subject:', emailSubject);
        console.log('\n');

        const emailResult = await sendEmail(facilityId, testEmail, emailSubject, emailMessage);

        console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
        console.log('Result:', JSON.stringify(emailResult, null, 2));
    } catch (emailError) {
        console.error('\n❌ EMAIL FAILED!');
        console.error('Error:', emailError.message);
        if (emailError.response) {
            console.error('Response Status:', emailError.response.status);
            console.error('Response Data:', emailError.response.data);
        }
    }

    console.log('\n========================================');
    console.log('TESTING COMPLETE');
    console.log('========================================\n');
}

// Run the tests
testCommunications()
    .then(() => {
        console.log('\n✅ All tests completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test suite failed:', error.message);
        process.exit(1);
    });
