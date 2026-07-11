const payservedb = require("payservedb");
const { getModel } = require("./getModel");

class EmailSmsService {
  async getEmailSmsModel(facilityId) {
    return await getModel(
      "EmailSmsQueue",
      payservedb.EmailSmsQueue.schema,
      facilityId,
    );
  }

  // Email service methods
  async addEmailToQueue(facilityId, emailData) {
    const { to, subject, text } = emailData;

    if (!to || !subject || !text) {
      throw new Error("Email to, subject, and text are required");
    }

    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    const newEmail = await emailSmsQueueModel.create({
      email: {
        to,
        subject,
        text,
      },
      type: "email",
      status: "pending",
      facilityId,
    });

    return newEmail;
  }

  async getEmailQueue(facilityId) {
    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    const emails = await emailSmsQueueModel.find({
      facilityId,
      type: "email",
    });

    return emails;
  }

  async deleteEmailFromQueue(facilityId, emailId) {
    if (!emailId) {
      throw new Error("Email ID is required");
    }

    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    const email = await emailSmsQueueModel.findOneAndDelete({
      _id: emailId,
      facilityId,
      type: "email",
    });

    if (!email) {
      throw new Error("Email not found");
    }

    return { message: "Email deleted successfully" };
  }

  async updateEmailInQueue(facilityId, emailId, updateData) {
    const { to, subject, text } = updateData;

    if (!emailId) {
      throw new Error("Email ID is required");
    }

    if (!to || !subject || !text) {
      throw new Error("Email to, subject, and text are required");
    }

    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    const emailUpdateData = {
      email: {
        to,
        subject,
        text,
      },
    };

    const updatedEmail = await emailSmsQueueModel.findOneAndUpdate(
      {
        _id: emailId,
        facilityId,
        type: "email",
      },
      emailUpdateData,
      { new: true },
    );

    if (!updatedEmail) {
      throw new Error("Email not found");
    }

    return updatedEmail;
  }

  // SMS service methods
  async addSmsToQueue(facilityId, smsData) {
    const { to, message, priority, status = "pending", metadata } = smsData;

    if (!to || !message) {
      throw new Error("SMS to and message are required");
    }

    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    // Create the basic SMS object with required fields
    const smsObject = {
      sms: {
        to,
        message,
      },
      type: "sms",
      status: status,
      facilityId,
    };

    // Add optional fields if they exist
    if (priority) {
      smsObject.priority = priority;
    }

    if (metadata) {
      smsObject.metadata = metadata;
    }

    // Create the SMS record in the queue
    const newSms = await emailSmsQueueModel.create(smsObject);

    console.log(`SMS queued successfully with ID: ${newSms._id}`);
    return newSms;
  }

  async getSmsQueue(facilityId) {
    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    const smsMessages = await emailSmsQueueModel.find({
      facilityId,
      type: "sms",
    });

    return smsMessages;
  }

  async deleteSmsFromQueue(facilityId, smsId) {
    if (!smsId) {
      throw new Error("SMS ID is required");
    }

    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    const sms = await emailSmsQueueModel.findOneAndDelete({
      _id: smsId,
      facilityId,
      type: "sms",
    });

    if (!sms) {
      throw new Error("SMS not found");
    }

    return { message: "SMS deleted successfully" };
  }

  async updateSmsInQueue(facilityId, smsId, updateData) {
    const { to, message } = updateData;

    if (!smsId) {
      throw new Error("SMS ID is required");
    }

    if (!to || !message) {
      throw new Error("SMS to and message are required");
    }

    const emailSmsQueueModel = await this.getEmailSmsModel(facilityId);

    const smsUpdateData = {
      sms: {
        to,
        message,
      },
    };

    const updatedSms = await emailSmsQueueModel.findOneAndUpdate(
      {
        _id: smsId,
        facilityId,
        type: "sms",
      },
      smsUpdateData,
      { new: true },
    );

    if (!updatedSms) {
      throw new Error("SMS not found");
    }

    return updatedSms;
  }
}

module.exports = EmailSmsService;
