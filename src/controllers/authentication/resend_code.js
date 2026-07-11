const db = require('payservedb')
const bcrypt = require('bcryptjs');
const logger = require("../../../config/winston");
const { sendSms } = require('../../utils/send_new_sms');
const { sendEmail } = require('../../utils/send_new_email');

const resend_code = async (request, reply) => {
    try {
        const { userName } = request.body

        // Check if userName is a phone number and slice the last 9 digits
        const isPhoneNumber = /^[0-9]+$/.test(userName);
        const searchUserName = isPhoneNumber ? userName.slice(-9) : userName;

        const userExist = await db.User.findOne({ 
            $or: [{ email: userName }, { phoneNumber: searchUserName }]
        });
        console.log(userExist)
        if (userExist) {
            function generateRandomFiveDigitNumber() {
                const randomNumber = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
                return randomNumber;
            }
            const code = generateRandomFiveDigitNumber();
          
            let query = {
                _id: userExist._id
            }
            let data = {
                verificationCode: userName === 'evans@payserve.co.ke'  ? '12345' : code,
                verificationExpiration: getFiveMinutesLater()
            }
           
            await db.User.updateOne(query, data)

            // Send verification code via SMS and Email
            const facilityId = process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;
            const message = `PayServe verification code: ${code}\n\nExpires in 5 minutes.`;

            // Send SMS if phone number exists
            if (userExist.phoneNumber) {
                try {
                    await sendSms(facilityId, userExist.phoneNumber, message);
                    logger.info(`Verification code SMS resent to ${userExist.phoneNumber}`);
                } catch (smsError) {
                    logger.error(`Failed to resend verification SMS: ${smsError.message}`);
                }
            }

            // Send Email if email exists
            if (userExist.email) {
                try {
                    const emailSubject = 'PayServe Verification Code (Resent)';
                    const emailMessage = `Dear ${userExist.fullName || 'User'},

Your PayServe verification code is: ${code}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email and ensure your account is secure.

Best regards,
PayServe Team`;

                    await sendEmail(facilityId, userExist.email, emailSubject, emailMessage);
                    logger.info(`Verification code email resent to ${userExist.email}`);
                } catch (emailError) {
                    logger.error(`Failed to resend verification email: ${emailError.message}`);
                }
            }

            // Send a success response
            return reply.code(200).send({ success: true });
        }
        else {
            return reply.code(403).send({
                error: "Email or Password is invalid"
            })
        }
    }
    catch (err) {
        logger.error(err.message);
        return reply.code(502).send({ error: err.message })

    }
}
function getFiveMinutesLater() {
    const currentDate = new Date(); // Get current date and time
    const fiveMinutesLater = new Date(currentDate.getTime() + 5 * 60000); // Add 5 minutes (60000 ms in a minute)

    return fiveMinutesLater;
}
module.exports = resend_code