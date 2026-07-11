const logger = require("../../../config/winston");
const { sendSms } = require("../../utils/send_new_sms");
const { sendEmail } = require("../../utils/send_new_email");
const db = require("payservedb");
require("dotenv").config();

const otp = async (request, reply) => {
  try {
    const { userName } = request.body;
    const isPhoneNumber = /^[0-9]+$/.test(userName);
    const searchUserName = isPhoneNumber ? userName.slice(-9) : userName;
    const default_facility_id = process.env.DFAULT_SMS_FACILITY_ID;
    logger.info("Successfully generated otp.");

    const userExist = await db.User.findOne({
      $or: [{ email: userName }, { phoneNumber: searchUserName }],
    });

    if (userExist) {
      console.log(userExist.verificationCode);
      console.log("Type of default_facility_id:", typeof default_facility_id);

      // Check if customerData exists and has at least one element
      if (
        !userExist.customerData ||
        !Array.isArray(userExist.customerData) ||
        userExist.customerData.length === 0
      ) {
        // Initialize customerData if it doesn't exist
        userExist.customerData = [{ facilityId: default_facility_id }];
        logger.info("Initialized customerData with default facility ID");
      } else if (!userExist.customerData[0].facilityId) {
        // Set facilityId if it doesn't exist in the first customerData element
        userExist.customerData[0].facilityId = default_facility_id;
        logger.info("Set default facility ID for existing customerData");
      }

      console.log(userExist.customerData[0].facilityId);
      let facilityId = userExist.customerData[0].facilityId;
      const facilityIdString = facilityId.toString();
      console.log("FacilityId as string:", facilityIdString);
      console.log("Type of facilityIdString:", typeof facilityIdString);

      // Save the user if we modified the customerData
      if (
        !userExist.customerData[0].facilityId ||
        userExist.customerData[0].facilityId === default_facility_id
      ) {
        await userExist.save();
        logger.info("Saved user with updated customerData");
      }

      await sendNotification2(
        userExist,
        userExist.verificationCode,
        facilityId,
      );
    } else {
      logger.warn(`User not found for userName: ${userName}`);
      return reply.code(404).send({ error: "User not found" });
    }

    return reply.code(200).send("Successfully sent otp");
  } catch (err) {
    logger.error(`OTP Error: ${err.message}`);
    console.error("Full error:", err);
    return reply.code(502).send({ error: err.message });
  }
};

const sendNotification2 = async (user, code, facilityId) => {
  const message = `Your verification code is ${code}. Please note that the code will expire in 5 minutes.`;
  console.log(
    `Sending OTP ${code} to ${user.phoneNumber} using facility ${facilityId}`,
  );

  const results = {
    sms: { success: false, error: null },
    email: { success: false, error: null },
  };

  // Send SMS independently (don't let it block email)
  if (user.phoneNumber) {
    try {
      const smsResponse = await sendSms(facilityId, user.phoneNumber, message);
      console.log("SMS Response:", smsResponse);

      if (smsResponse && smsResponse.success) {
        results.sms.success = true;
        logger.info(
          `SMS OTP sent successfully to ${user.phoneNumber} via ${smsResponse.method} (${smsResponse.configSource} config)`,
        );
      } else {
        results.sms.error = "SMS response indicates failure";
        logger.warn(
          `SMS OTP sending may have failed for ${user.phoneNumber}:`,
          smsResponse,
        );
      }
    } catch (smsError) {
      results.sms.error = smsError.message;
      logger.error(
        `Error sending SMS OTP to ${user.phoneNumber}: ${smsError.message}`,
      );
      console.error("SMS Error details:", smsError);
      // Don't throw - continue to email if available
    }
  }

  // Send Email independently (if user has email)
  if (user.email) {
    try {
      const emailResponse = await sendEmail(
        facilityId,
        user.email,
        "OTP Verification Code",
        message,
      );

      if (emailResponse && emailResponse.success) {
        results.email.success = true;
        logger.info(
          `Email OTP sent successfully to ${user.email} via ${emailResponse.method} (${emailResponse.configSource} config)`,
        );
      } else {
        results.email.error = "Email response indicates failure";
        logger.warn(
          `Email OTP sending may have failed for ${user.email}:`,
          emailResponse,
        );
      }
    } catch (emailError) {
      results.email.error = emailError.message;
      logger.error(
        `Error sending Email OTP to ${user.email}: ${emailError.message}`,
      );
      console.error("Email Error details:", emailError);
    }
  }

  // Log overall results
  const sentMethods = [];
  if (results.sms.success) sentMethods.push("SMS");
  if (results.email.success) sentMethods.push("Email");

  if (sentMethods.length > 0) {
    logger.info(
      `OTP sent successfully via: ${sentMethods.join(", ")} for user ${user._id}`,
    );
  } else {
    logger.error(
      `All OTP delivery methods failed for user ${user._id}. SMS: ${results.sms.error || "not attempted"}, Email: ${results.email.error || "not attempted"}`,
    );
  }
};

module.exports = otp;
