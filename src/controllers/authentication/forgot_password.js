const db = require("payservedb");
const logger = require("../../../config/winston");
const { forgotPasswordValidator } = require("../../utils/validator");
const { sendSms } = require('../../utils/send_new_sms');
const { sendEmail } = require("../../utils/send_new_email");

const forgot_password = async (request, reply) => {
  try {
    const validationResults = await forgotPasswordValidator.validate(
      request.body,
    );
    if (validationResults.error) {
      logger.error(validationResults.error.details[0].message);
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }
    const { userName } = validationResults.value;
    const isPhoneNumber = /^[0-9]+$/.test(userName);
    const searchUserName = isPhoneNumber ? userName.slice(-9) : userName;
    const userExist = await db.User.findOne({
      $or: [{ email: userName }, { phoneNumber: searchUserName }],
    });
    if (userExist) {
      sendNotification(userExist);
      return reply.code(200).send("User exists");
    } else {
      return reply.code(403).send({
        error: "User Not Found.",
      });
    }
  } catch (err) {
    logger.error(err.message);
    return reply.code(502).send({ error: err.message });
  }
};

const sendNotification = async (user) => {
  let message;
  if (user.type === "Universal") {
    message = `Dear User Click the below link to reset your password: \n${process.env.coreFrontEndUrl}/reset_password/${user._id}`;
  } else if (user.type === "Company") {
    message = `Dear User Click the below link to reset your password: \n${process.env.appFrontEndUrl}/reset_password/${user._id}`;
  } else if (user.type === "Resident") {
    message = `Dear Customer Click the below link to reset your password: \n${process.env.residentFrontEndUrl}/reset_password/${user._id}`;
  } else if (user.type === "Landlord") {
    message = `Dear Customer Click the below link to reset your password: \n${process.env.landlordFrontEndUrl}/reset_password/${user._id}`;
  }

  if (user.email !== undefined) {
    try {
      await sendSms(
        user.customerData[0].facilityId || null,
        user.phoneNumber,
        message,
      );

      await sendEmail(
        user.customerData[0].facilityId || null,
        user.email,
        "RESET PASSWORD",
        message,
      );

      logger.info(
        `Password reset notifications sent to ${user.email} and ${user.phoneNumber}`,
      );
    } catch (error) {
      logger.error(
        `Failed to send password reset notifications to user ${user._id}:`,
        error.message,
      );
    }
  }
};

module.exports = forgot_password;
