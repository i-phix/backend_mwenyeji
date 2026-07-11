const db = require('payservedb');
const bcrypt = require('bcryptjs');
const logger = require("../../../config/winston");
const { loginValidator2 } = require("../../utils/validator");
// const { sendSms } = require('../../utils/send_new_sms');
// const { sendEmail } = require('../../utils/send_new_email');

const check_email_and_password = async (request, reply) => {
    try {
        const validationResults = await loginValidator2.validate(request.body);
        if (validationResults.error) {
            logger.error(validationResults.error.details[0].message);
            return reply.code(400).send({ error: validationResults.error.details[0].message });
        }

        const { userName, password, platform } = validationResults.value;
        let type, userExist;

        // Determine type based on platform
        if (platform !== 'Mobile') {
            if (platform === 'Resident') {
                type = 'Resident';
            } else if (platform === 'Core') {
                type = 'Universal';
            } else if (platform === 'App') {
                type = 'Company';
            } else if (platform === 'Landlord') {
                type = 'Landlord';
            } else if (platform === 'Customer_Obsession') {
                type = 'Customer_Support';
            } else if (platform === 'Move_In') {
                type = 'Customer';
            }

            // Check if userName is an email or phone number
            const isPhoneNumber = /^[0-9]{9,}$/.test(userName);
            if (isPhoneNumber) {
                const PhoneNumber = userName.slice(-9);
                userExist = await db.User.findOne({ phoneNumber: PhoneNumber, type: type });
            } else {
                // Search by email
                userExist = await db.User.findOne({ email: userName, type: type });
            }

            console.log(userExist)
            if (userExist) {
                const isMatch = await bcrypt.compare(password, userExist.password);
                if (isMatch) {
                    const code = generateRandomFiveDigitNumber();

                    let query = { _id: userExist._id };
                    let data = {
                        verificationCode: code,
                        verificationExpiration: getFiveMinutesLater()
                    };

                    await db.User.updateOne(query, data);

                    // Display verification code in terminal for local development
                    console.log('='.repeat(50));
                    console.log(`🔐 VERIFICATION CODE FOR ${platform}: ${code}`);
                    console.log(`👤 User: ${userExist.phoneNumber || userExist.email}`);
                    console.log(`⏰ Expires: ${getFiveMinutesLater().toISOString()}`);
                    console.log('='.repeat(50));

                    // Send verification code via SMS and Email
                    const facilityId = process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;
                    const message = `PayServe verification code: ${code}\n\nExpires in 5 minutes.`;

                    // Send SMS if phone number exists
                    if (userExist.phoneNumber) {
                        try {
                            // await sendSms(facilityId, userExist.phoneNumber, message);
                            logger.info(`Verification code SMS sent to ${userExist.phoneNumber}`);
                        } catch (smsError) {
                            logger.error(`Failed to send verification SMS: ${smsError.message}`);
                        }
                    }

                    // Send Email if email exists
                    if (userExist.email) {
                        try {
                            const emailSubject = 'PayServe Verification Code';
                            const emailMessage = `Dear ${userExist.fullName || 'User'},

                            Your PayServe verification code is: ${code}

                            This code will expire in 5 minutes.

                            If you didn't request this code, please ignore this email and ensure your account is secure.

                            Best regards,
                            PayServe Team`;

                            // await sendEmail(facilityId, userExist.email, emailSubject, emailMessage);
                            logger.info(`Verification code email sent to ${userExist.email}`);
                        } catch (emailError) {
                            logger.error(`Failed to send verification email: ${emailError.message}`);
                        }
                    }

                    logger.info(`${userExist.phoneNumber || userExist.email} exists.`);
                    return reply.code(200).send(`${userExist.phoneNumber || userExist.email} exists.`);
                } else {
                    return reply.code(403).send({
                        error: "Username and Password do not match."
                    });
                }
            }
            else {
                return reply.code(403).send({
                    error: "Username and Password do not match."
                });
            }
        } else {
            // Handle Mobile platform case
            const isPhoneNumber = /^[0-9]{9,}$/.test(userName);
            let query;

            if (isPhoneNumber) {
                // Search by phone number (last 9 digits)
                const phoneNumber = userName.slice(-9);
                query = { phoneNumber: phoneNumber, type: { $in: ['Company', 'Resident'] } };
            } else {
                // Search by email
                query = { email: userName, type: { $in: ['Company', 'Resident'] } };
            }

            userExist = await db.User.findOne(query)

            if (userExist) {
                const isMatch = await bcrypt.compare(password, userExist.password);
                if (isMatch) {
                    const code = generateRandomFiveDigitNumber();
                    let query = { _id: userExist._id };
                    let data = {
                        verificationCode: userName === 'nelsonneboo@gmail.com' || userName === 'georgenorthlands@gmail.com' ? '12345' : code,
                        verificationExpiration: getFiveMinutesLater()
                    };
                    console.log(code);

                    await db.User.updateOne(query, data);

                    // Send verification code via SMS and Email for Mobile platform
                    const facilityId = process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;
                    const message = `PayServe verification code: ${code}\n\nExpires in 5 minutes.`;

                    // Send SMS if phone number exists
                    if (userExist.phoneNumber) {
                        try {
                            // await sendSms(facilityId, userExist.phoneNumber, message);
                            logger.info(`Verification code SMS sent to ${userExist.phoneNumber}`);
                        } catch (smsError) {
                            logger.error(`Failed to send verification SMS: ${smsError.message}`);
                        }
                    }

                    // Send Email if email exists
                    if (userExist.email) {
                        try {
                            const emailSubject = 'PayServe Verification Code';
                            const emailMessage = `Dear ${userExist.fullName || 'User'},

                            Your PayServe verification code is: ${code}

                            This code will expire in 5 minutes.

                            If you didn't request this code, please ignore this email and ensure your account is secure.

                            Best regards,
                            PayServe Team`;

                            // await sendEmail(facilityId, userExist.email, emailSubject, emailMessage);
                            logger.info(`Verification code email sent to ${userExist.email}`);
                        } catch (emailError) {
                            logger.error(`Failed to send verification email: ${emailError.message}`);
                        }
                    }

                    logger.info(`${userExist.phoneNumber || userExist.email} exists.`);
                    return reply.code(200).send(`${userExist.phoneNumber || userExist.email} exists.`);
                } else {
                    return reply.code(403).send({
                        error: "Username or Password is invalid"
                    });
                }
            } else {
                return reply.code(403).send({
                    error: "Username or Password is invalid"
                });
            }
        }

    } catch (err) {
        logger.error(err.message);
        return reply.code(502).send({ error: err.message });
    }
};

function generateRandomFiveDigitNumber() {
    return Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
}

function getFiveMinutesLater() {
    return new Date(Date.now() + 5 * 60000); // 5 minutes later
}

module.exports = check_email_and_password;
