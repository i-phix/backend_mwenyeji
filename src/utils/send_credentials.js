const { sendSms } = require('./send_new_sms');
const { sendEmail } = require('./send_new_email');

const sendUserCredentials = async ({ facilityId, user, password, userType }) => {
    const userConfig = {
        Landlord: {
            url: process.env.landlordFrontEndUrl,
            resetUrl: 'https://landlord.payserve.co.ke/reset_password'
        },
        Resident: {
            url: process.env.residentFrontEndUrl,
            resetUrl: 'https://resident.payserve.co.ke/reset_password'
        }
    };

    const config = userConfig[userType] || userConfig.Resident;
    const northlandsFacilityId = process.env.northlandsFacilityId;

    let message = `PayServe LOGIN CREDENTIALS: Dear ${userType}, please login to ${config.url}
   Username: ${user.email},
   Password: ${password}
   Reset your password here:
   ${config.resetUrl}/${user._id}`;

    if (facilityId === northlandsFacilityId) {
        message += `
   
   Download our mobile app:
   • Android: https://play.google.com/store/apps/details?id=com.northlandsapp.app
   • iOS: https://apps.apple.com/us/app/northland-heights/id6756302852`;
    }

    sendSms(facilityId, user.phoneNumber, message);
    sendEmail(facilityId, user.email, 'PAYSERVE LOGIN CREDENTIALS', message);
};

module.exports = { sendUserCredentials };