require("dotenv").config();

const DEFAULT_SMS_FACILITY_ID = process.env.DEFAULT_SMS_FACILITY_ID;
const DEFAULT_EMAIL_FACILITY_ID = process.env.DEFAULT_EMAIL_FACILITY_ID;

const smsSettings = {
  senderId: process.env.SENDERID,
  apiKey: process.env.API_KEY,
};

const emailConfig = {
  sender: process.env.EMAIL_SENDER,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE,
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
  senderName: process.env.EMAIL_SENDER_NAME || "Payserve",
};

module.exports = {
  smsSettings,
  emailConfig,
  DEFAULT_SMS_FACILITY_ID,
  DEFAULT_EMAIL_FACILITY_ID,
};
