const EmailSmsService = require("../../../../../utils/emailSmsService");

const emailSmsService = new EmailSmsService();

// Email controller functions
const addEmailToQueue = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const emailData = request.body;

    const newEmail = await emailSmsService.addEmailToQueue(
      facilityId,
      emailData,
    );

    reply.code(201).send({
      message: "Email added to queue successfully",
      email: newEmail,
    });
  } catch (error) {
    console.error(error);

    if (error.message === "Email to, subject, and text are required") {
      return reply.code(400).send({ error: error.message });
    }

    reply.code(500).send({ error: error.message });
  }
};

const viewEmailQueue = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const emails = await emailSmsService.getEmailQueue(facilityId);

    reply.code(200).send({ emails });
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: error.message });
  }
};

const deleteEmailFromQueue = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;

    const result = await emailSmsService.deleteEmailFromQueue(facilityId, id);

    reply.code(200).send(result);
  } catch (error) {
    console.error(error);

    if (
      error.message === "Email not found" ||
      error.message === "Email ID is required"
    ) {
      return reply.code(404).send({ error: error.message });
    }

    reply.code(500).send({ error: error.message });
  }
};

const updateEmailInQueue = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;
    const updateData = request.body;

    const updatedEmail = await emailSmsService.updateEmailInQueue(
      facilityId,
      id,
      updateData,
    );

    reply.code(200).send({
      message: "Email updated successfully",
      email: updatedEmail,
    });
  } catch (error) {
    console.error(error);

    if (
      error.message === "Email not found" ||
      error.message === "Email ID is required"
    ) {
      return reply.code(404).send({ error: error.message });
    }

    if (error.message === "Email to, subject, and text are required") {
      return reply.code(400).send({ error: error.message });
    }

    reply.code(500).send({ error: error.message });
  }
};

// SMS controller functions
const addSmsToQueue = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const smsData = request.body;

    const newSms = await emailSmsService.addSmsToQueue(facilityId, smsData);

    reply.code(201).send({
      message: "SMS added to queue successfully",
      sms: newSms,
    });
  } catch (error) {
    console.error(error);

    if (error.message === "SMS to and message are required") {
      return reply.code(400).send({ error: error.message });
    }

    reply.code(500).send({ error: error.message });
  }
};

const viewSmsQueue = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const smsMessages = await emailSmsService.getSmsQueue(facilityId);

    reply.code(200).send({ smsMessages });
  } catch (error) {
    console.error(error);
    reply.code(500).send({ error: error.message });
  }
};

const deleteSmsFromQueue = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;

    const result = await emailSmsService.deleteSmsFromQueue(facilityId, id);

    reply.code(200).send(result);
  } catch (error) {
    console.error(error);

    if (
      error.message === "SMS not found" ||
      error.message === "SMS ID is required"
    ) {
      return reply.code(404).send({ error: error.message });
    }

    reply.code(500).send({ error: error.message });
  }
};

const updateSmsInQueue = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;
    const updateData = request.body;

    const updatedSms = await emailSmsService.updateSmsInQueue(
      facilityId,
      id,
      updateData,
    );

    reply.code(200).send({
      message: "SMS updated successfully",
      sms: updatedSms,
    });
  } catch (error) {
    console.error(error);

    if (
      error.message === "SMS not found" ||
      error.message === "SMS ID is required"
    ) {
      return reply.code(404).send({ error: error.message });
    }

    if (error.message === "SMS to and message are required") {
      return reply.code(400).send({ error: error.message });
    }

    reply.code(500).send({ error: error.message });
  }
};

module.exports = {
  // Email functions
  addEmailToQueue,
  viewEmailQueue,
  deleteEmailFromQueue,
  updateEmailInQueue,
  // SMS functions
  addSmsToQueue,
  viewSmsQueue,
  deleteSmsFromQueue,
  updateSmsInQueue,
};
