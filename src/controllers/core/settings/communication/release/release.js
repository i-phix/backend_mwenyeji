const {
  sendDirectEmail,
  sendEmail,
  sendEmailToQueue,
  sendEmailWithFallback,
} = require("../../../../../utils/send_new_email");
const {
  sendSms,
  sendDirectSms,
  sendSmsToQueue,
  sendSmsWithFallback,
} = require("../../../../../utils/send_new_sms");
const EmailSmsService = require("../../../../../utils/emailSmsService");

const emailSmsService = new EmailSmsService();

// ==================== EMAIL RELEASE FUNCTIONS ====================

// Release a single email (send directly)
const releaseEmail = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;

    if (!facilityId) {
      return reply.status(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    if (!id) {
      return reply.status(400).send({
        success: false,
        error: "Email ID is required",
      });
    }

    // Get the email from queue
    const emailSmsQueueModel =
      await emailSmsService.getEmailSmsModel(facilityId);
    const queuedEmail = await emailSmsQueueModel.findById(id);

    if (!queuedEmail || queuedEmail.type !== "email") {
      return reply.status(404).send({
        success: false,
        error: "Email not found in queue",
      });
    }

    const { to, subject, text } = queuedEmail.email;

    try {
      // For single email release, send directly
      console.log(`Releasing single email directly: ${id}`);
      const result = await sendEmail(facilityId, to, subject, text);

      if (result.success) {
        // Email sent successfully - delete from queue
        await emailSmsService.deleteEmailFromQueue(facilityId, id);

        return reply.send({
          success: true,
          message: "Email released and sent directly",
          data: {
            emailId: id,
            status: "sent",
            method: "direct",
          },
        });
      } else {
        // Email failed to send - update status to failed
        await emailSmsQueueModel.findByIdAndUpdate(id, {
          status: "failed",
        });

        return reply.status(400).send({
          success: false,
          message: "Email failed to send directly",
          data: {
            emailId: id,
            status: "failed",
            error: result.error || result.message,
          },
        });
      }
    } catch (sendError) {
      // Email sending threw an error - update status to failed
      await emailSmsQueueModel.findByIdAndUpdate(id, {
        status: "failed",
      });

      return reply.status(400).send({
        success: false,
        message: "Email failed to send directly",
        data: {
          emailId: id,
          status: "failed",
          error: sendError.message,
        },
      });
    }
  } catch (error) {
    console.error(
      `Failed to release email ${request.params.id}: ${error.message}`,
    );
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Helper function to send email to external queue
const sendEmailToExternalQueue = async (facilityId, emailData) => {
  try {
    const { to, subject, text } = emailData;

    // Use sendEmailToQueue function to send to external queue endpoint
    const result = await sendEmailToQueue(
      facilityId,
      to,
      subject,
      text,
      null,
      "high",
    );

    if (result.success) {
      return {
        success: true,
        message: "Email sent to external queue successfully",
        method: "external_queue",
      };
    } else {
      return {
        success: false,
        message: "Failed to send email to external queue",
        error: result.error || result.message,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Error sending email to external queue",
      error: error.message,
    };
  }
};

// Release multiple emails (send to external queue for batch processing)
const releaseEmails = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { emailIds } = request.body;

    if (!facilityId) {
      return reply.status(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "Email IDs array is required",
      });
    }

    console.log(
      `Releasing ${emailIds.length} emails to external queue for facility ${facilityId}`,
    );

    const results = [];
    const chunkSize = 10;
    const delayBetweenChunks = 2000; // 2 seconds

    // Get email data for all requested emails
    const emailSmsQueueModel =
      await emailSmsService.getEmailSmsModel(facilityId);
    const queuedEmails = await emailSmsQueueModel.find({
      _id: { $in: emailIds },
      facilityId,
      type: "email",
    });

    if (queuedEmails.length === 0) {
      return reply.status(404).send({
        success: false,
        error: "No valid emails found in queue",
      });
    }

    // Split emails into chunks of 10
    const chunks = [];
    for (let i = 0; i < queuedEmails.length; i += chunkSize) {
      chunks.push(queuedEmails.slice(i, i + chunkSize));
    }

    console.log(
      `Processing ${queuedEmails.length} emails in ${chunks.length} chunks via external queue`,
    );

    // Process each chunk with delay
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      console.log(
        `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} emails via external queue`,
      );

      // Process all emails in current chunk simultaneously - send to external queue
      const chunkPromises = chunk.map(async (queuedEmail) => {
        try {
          // Send to external queue instead of sending directly
          const result = await sendEmailToExternalQueue(
            facilityId,
            queuedEmail.email,
          );

          if (result.success) {
            // Email sent to external queue successfully - delete from internal queue
            await emailSmsService.deleteEmailFromQueue(
              facilityId,
              queuedEmail._id,
            );

            return {
              success: true,
              message: "Email sent to external queue successfully",
              emailId: queuedEmail._id,
              status: "queued_externally",
            };
          } else {
            // Failed to send to external queue - update status to failed
            await emailSmsQueueModel.findByIdAndUpdate(queuedEmail._id, {
              status: "failed",
            });

            return {
              success: false,
              message: "Failed to send email to external queue",
              emailId: queuedEmail._id,
              status: "failed",
              error: result.error,
            };
          }
        } catch (error) {
          // Update status to failed on error
          await emailSmsQueueModel.findByIdAndUpdate(queuedEmail._id, {
            status: "failed",
          });

          return {
            success: false,
            message: "Error processing email for external queue",
            emailId: queuedEmail._id,
            status: "failed",
            error: error.message,
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      // Process results
      chunkResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          const emailId = chunk[index]._id;
          results.push({
            success: false,
            message: result.reason?.message || "Unknown error",
            emailId,
            status: "error",
          });
        }
      });

      // Add delay before next chunk (except for the last chunk)
      if (chunkIndex < chunks.length - 1) {
        console.log(`Waiting ${delayBetweenChunks}ms before next chunk...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenChunks));
      }
    }

    // Calculate summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return reply.send({
      success: true,
      message: `Bulk email release completed: ${successful} sent to external queue, ${failed} failed`,
      data: {
        totalProcessed: results.length,
        successful,
        failed,
        method: "external_queue_batch",
        results,
      },
    });
  } catch (error) {
    console.error("Error in bulk release emails route:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Release all emails for a facility (send to external queue for batch processing)
const releaseAllEmails = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.status(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    console.log(
      `Releasing all emails to external queue for facility ${facilityId}`,
    );

    // Get all pending emails for the facility
    const emailSmsQueueModel =
      await emailSmsService.getEmailSmsModel(facilityId);
    const pendingEmails = await emailSmsQueueModel.find({
      facilityId,
      type: "email",
      status: "pending",
    });

    if (pendingEmails.length === 0) {
      return reply.send({
        success: true,
        message: "No pending emails to release",
        data: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          method: "external_queue_batch",
          results: [],
        },
      });
    }

    console.log(
      `Found ${pendingEmails.length} pending emails to send to external queue`,
    );

    // Use the same external queue logic as bulk release
    const results = [];
    const chunkSize = 10;
    const delayBetweenChunks = 2000; // 2 seconds

    const chunks = [];
    for (let i = 0; i < pendingEmails.length; i += chunkSize) {
      chunks.push(pendingEmails.slice(i, i + chunkSize));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      const chunkPromises = chunk.map(async (queuedEmail) => {
        try {
          // Send to external queue
          const result = await sendEmailToExternalQueue(
            facilityId,
            queuedEmail.email,
          );

          if (result.success) {
            // Email sent to external queue successfully - delete from internal queue
            await emailSmsService.deleteEmailFromQueue(
              facilityId,
              queuedEmail._id,
            );

            return {
              success: true,
              message: "Email sent to external queue successfully",
              emailId: queuedEmail._id,
              status: "queued_externally",
            };
          } else {
            // Failed to send to external queue - update status to failed
            await emailSmsQueueModel.findByIdAndUpdate(queuedEmail._id, {
              status: "failed",
            });

            return {
              success: false,
              message: "Failed to send email to external queue",
              emailId: queuedEmail._id,
              status: "failed",
              error: result.error,
            };
          }
        } catch (error) {
          await emailSmsQueueModel.findByIdAndUpdate(queuedEmail._id, {
            status: "failed",
          });

          return {
            success: false,
            message: "Error processing email for external queue",
            emailId: queuedEmail._id,
            status: "failed",
            error: error.message,
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      chunkResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          const emailId = chunk[index]._id;
          results.push({
            success: false,
            message: result.reason?.message || "Unknown error",
            emailId,
            status: "error",
          });
        }
      });

      if (chunkIndex < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenChunks));
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return reply.send({
      success: true,
      message: `Release all emails completed: ${successful} sent to external queue, ${failed} failed`,
      data: {
        totalProcessed: results.length,
        successful,
        failed,
        method: "external_queue_batch",
        results,
      },
    });
  } catch (error) {
    console.error("Error in release all emails route:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// ==================== SMS RELEASE FUNCTIONS ====================

// Release a single SMS (send directly) - DIRECT ENDPOINT
const releaseSms = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;

    if (!facilityId) {
      return reply.status(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    if (!id) {
      return reply.status(400).send({
        success: false,
        error: "SMS ID is required",
      });
    }

    console.log(`🚀 Releasing single SMS with direct endpoint: ${id}`);

    // Get the SMS from queue
    const emailSmsQueueModel =
      await emailSmsService.getEmailSmsModel(facilityId);
    const queuedSms = await emailSmsQueueModel.findById(id);

    if (!queuedSms || queuedSms.type !== "sms") {
      return reply.status(404).send({
        success: false,
        error: "SMS not found in queue",
      });
    }

    const { to, message } = queuedSms.sms;

    try {
      // For single SMS release, use DIRECT sending endpoint
      const result = await sendSms(facilityId, to, message);

      if (result.success) {
        // SMS sent successfully - delete from queue
        await emailSmsService.deleteSmsFromQueue(facilityId, id);

        console.log(
          `✅ Single SMS ${id} sent successfully via direct endpoint`,
        );
        return reply.send({
          success: true,
          message: "SMS released and sent directly",
          data: {
            smsId: id,
            status: "sent",
            method: "direct",
          },
        });
      } else {
        // SMS failed to send - update status to failed
        await emailSmsQueueModel.findByIdAndUpdate(id, {
          status: "failed",
        });

        console.log(`❌ Single SMS ${id} failed to send:`, result.error);
        return reply.status(400).send({
          success: false,
          message: "SMS failed to send directly",
          data: {
            smsId: id,
            status: "failed",
            error: result.error || result.message,
          },
        });
      }
    } catch (sendError) {
      // SMS sending threw an error - update status to failed
      await emailSmsQueueModel.findByIdAndUpdate(id, {
        status: "failed",
      });

      console.log(`❌ Single SMS ${id} threw error:`, sendError.message);
      return reply.status(400).send({
        success: false,
        message: "SMS failed to send directly",
        data: {
          smsId: id,
          status: "failed",
          error: sendError.message,
        },
      });
    }
  } catch (error) {
    console.error(
      `Failed to release SMS ${request.params.id}: ${error.message}`,
    );
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Helper function to send SMS to external queue - EXTERNAL QUEUE ENDPOINT
const sendSmsToExternalQueue = async (facilityId, smsData) => {
  try {
    const { to, message } = smsData;

    console.log(`📤 Sending SMS to external queue: ${to}`);
    // Use sendSmsToQueue function to send to external queue endpoint
    const result = await sendSmsToQueue(facilityId, to, message, "high");

    if (result.success) {
      console.log(`✅ SMS sent to external queue successfully: ${to}`);
      return {
        success: true,
        message: "SMS sent to external queue successfully",
        method: "external_queue",
      };
    } else {
      console.log(
        `❌ Failed to send SMS to external queue: ${to}`,
        result.error,
      );
      return {
        success: false,
        message: "Failed to send SMS to external queue",
        error: result.error || result.message,
      };
    }
  } catch (error) {
    console.log(
      `❌ Error sending SMS to external queue: ${smsData.to}`,
      error.message,
    );
    return {
      success: false,
      message: "Error sending SMS to external queue",
      error: error.message,
    };
  }
};

// Release multiple SMS (bulk) - EXTERNAL QUEUE ENDPOINT IN BATCHES
const releaseSmsMessages = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { smsIds } = request.body;
    console.log(smsIds  );

    if (!facilityId) {
      return reply.status(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    if (!smsIds || !Array.isArray(smsIds) || smsIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "SMS IDs array is required",
      });
    }

    console.log(
      `🚀 Releasing ${smsIds.length} SMS to external queue in batches for facility ${facilityId}`,
    );

    const results = [];
    const chunkSize = 10;
    const delayBetweenChunks = 2000; // 2 seconds

    // Get SMS data for all requested SMS
    const emailSmsQueueModel =
      await emailSmsService.getEmailSmsModel(facilityId);
    const queuedSmsMessages = await emailSmsQueueModel.find({
      _id: { $in: smsIds },
      facilityId,
      type: "sms",
    });

    if (queuedSmsMessages.length === 0) {
      return reply.status(404).send({
        success: false,
        error: "No valid SMS found in queue",
      });
    }

    // Split SMS into chunks of 10
    const chunks = [];
    for (let i = 0; i < queuedSmsMessages.length; i += chunkSize) {
      chunks.push(queuedSmsMessages.slice(i, i + chunkSize));
    }

    console.log(
      `📦 Processing ${queuedSmsMessages.length} SMS in ${chunks.length} chunks via external queue`,
    );

    // Process each chunk with delay
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      console.log(
        `🔄 Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} SMS via external queue`,
      );

      // Process all SMS in current chunk simultaneously - send to external queue
      const chunkPromises = chunk.map(async (queuedSms) => {
        try {
          // Send to external queue instead of sending directly
          const result = await sendSmsToExternalQueue(
            facilityId,
            queuedSms.sms,
          );

          if (result.success) {
            // SMS sent to external queue successfully - delete from internal queue
            await emailSmsService.deleteSmsFromQueue(facilityId, queuedSms._id);

            return {
              success: true,
              message: "SMS sent to external queue successfully",
              smsId: queuedSms._id,
              status: "queued_externally",
            };
          } else {
            // Failed to send to external queue - update status to failed
            await emailSmsQueueModel.findByIdAndUpdate(queuedSms._id, {
              status: "failed",
            });

            return {
              success: false,
              message: "Failed to send SMS to external queue",
              smsId: queuedSms._id,
              status: "failed",
              error: result.error,
            };
          }
        } catch (error) {
          // Update status to failed on error
          await emailSmsQueueModel.findByIdAndUpdate(queuedSms._id, {
            status: "failed",
          });

          return {
            success: false,
            message: "Error processing SMS for external queue",
            smsId: queuedSms._id,
            status: "failed",
            error: error.message,
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      // Process results
      chunkResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          const smsId = chunk[index]._id;
          results.push({
            success: false,
            message: result.reason?.message || "Unknown error",
            smsId,
            status: "error",
          });
        }
      });

      // Add delay before next chunk (except for the last chunk)
      if (chunkIndex < chunks.length - 1) {
        console.log(`⏳ Waiting ${delayBetweenChunks}ms before next chunk...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenChunks));
      }
    }

    // Calculate summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `✅ Bulk SMS release completed: ${successful} sent to external queue, ${failed} failed`,
    );

    return reply.send({
      success: true,
      message: `Bulk SMS release completed: ${successful} sent to external queue, ${failed} failed`,
      data: {
        totalProcessed: results.length,
        successful,
        failed,
        method: "external_queue_batch",
        results,
      },
    });
  } catch (error) {
    console.error("Error in bulk release SMS route:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Release all SMS for a facility - EXTERNAL QUEUE ENDPOINT IN BATCHES
const releaseAllSms = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.status(400).send({
        success: false,
        error: "Facility ID is required",
      });
    }

    console.log(
      `🚀 Releasing all SMS to external queue in batches for facility ${facilityId}`,
    );

    // Get all pending SMS for the facility
    const emailSmsQueueModel =
      await emailSmsService.getEmailSmsModel(facilityId);
    const pendingSms = await emailSmsQueueModel.find({
      facilityId,
      type: "sms",
      status: "pending",
    });

    if (pendingSms.length === 0) {
      return reply.send({
        success: true,
        message: "No pending SMS to release",
        data: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          method: "external_queue_batch",
          results: [],
        },
      });
    }

    console.log(
      `📦 Found ${pendingSms.length} pending SMS to send to external queue in batches`,
    );

    // Use the same external queue logic as bulk release
    const results = [];
    const chunkSize = 10;
    const delayBetweenChunks = 2000; // 2 seconds

    const chunks = [];
    for (let i = 0; i < pendingSms.length; i += chunkSize) {
      chunks.push(pendingSms.slice(i, i + chunkSize));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      console.log(
        `🔄 Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} SMS via external queue`,
      );

      const chunkPromises = chunk.map(async (queuedSms) => {
        try {
          // Send to external queue
          const result = await sendSmsToExternalQueue(
            facilityId,
            queuedSms.sms,
          );

          if (result.success) {
            // SMS sent to external queue successfully - delete from internal queue
            await emailSmsService.deleteSmsFromQueue(facilityId, queuedSms._id);

            return {
              success: true,
              message: "SMS sent to external queue successfully",
              smsId: queuedSms._id,
              status: "queued_externally",
            };
          } else {
            // Failed to send to external queue - update status to failed
            await emailSmsQueueModel.findByIdAndUpdate(queuedSms._id, {
              status: "failed",
            });

            return {
              success: false,
              message: "Failed to send SMS to external queue",
              smsId: queuedSms._id,
              status: "failed",
              error: result.error,
            };
          }
        } catch (error) {
          await emailSmsQueueModel.findByIdAndUpdate(queuedSms._id, {
            status: "failed",
          });

          return {
            success: false,
            message: "Error processing SMS for external queue",
            smsId: queuedSms._id,
            status: "failed",
            error: error.message,
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      chunkResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          const smsId = chunk[index]._id;
          results.push({
            success: false,
            message: result.reason?.message || "Unknown error",
            smsId,
            status: "error",
          });
        }
      });

      if (chunkIndex < chunks.length - 1) {
        console.log(`⏳ Waiting ${delayBetweenChunks}ms before next chunk...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenChunks));
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `✅ Release all SMS completed: ${successful} sent to external queue, ${failed} failed`,
    );

    return reply.send({
      success: true,
      message: `Release all SMS completed: ${successful} sent to external queue, ${failed} failed`,
      data: {
        totalProcessed: results.length,
        successful,
        failed,
        method: "external_queue_batch",
        results,
      },
    });
  } catch (error) {
    console.error("Error in release all SMS route:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  // Email release functions
  releaseEmail,
  releaseEmails,
  releaseAllEmails,
  // SMS release functions
  releaseSms,
  releaseSmsMessages,
  releaseAllSms,
};
