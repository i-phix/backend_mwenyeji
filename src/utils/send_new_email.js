const axios = require("axios");
require("dotenv").config();
const { emailConfig } = require("./communication_defaults");
const EmailSmsService = require("./emailSmsService");

const BACKEND_URL = process.env.BACKEND_URL;
const COMMUNICATIONS_ENDPOINT = process.env.COMMUNICATIONS_ENDPOINT;
const DIRECT_EMAIL_ENDPOINT = `${COMMUNICATIONS_ENDPOINT}/api/email/send`;
const EMAIL_QUEUE_ENDPOINT = `${COMMUNICATIONS_ENDPOINT}/api/email-queue/send`;
const DEFAULT_EMAIL_FACILITY_ID = process.env.DEFAULT_EMAIL_FACILITY_ID;

// Service class to handle facility status and queue management
class EnhancedEmailService {
  constructor() {
    this.emailSmsService = new EmailSmsService();
  }

  async getFacilityStatus(facilityId) {
    if (!facilityId) {
      throw new Error("Facility ID is required");
    }

    try {
      console.log(
        `Fetching facility status via API for facility ${facilityId}`,
      );
      const response = await axios.get(
        `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/status`,
        { timeout: 5000 },
      );

      if (
        !response.data ||
        !response.data.emailStatus ||
        !response.data.smsStatus
      ) {
        throw new Error("Invalid response format from status API");
      }

      console.log(
        `Successfully retrieved facility status: SMS=${response.data.smsStatus}, Email=${response.data.emailStatus}`,
      );

      return {
        emailStatus: response.data.emailStatus,
        smsStatus: response.data.smsStatus,
        facilityId: facilityId,
      };
    } catch (error) {
      console.error(`Error fetching facility status: ${error.message}`);
      // Fallback to default status if API fails
      console.warn("Using default 'send' status due to API error");
      return {
        emailStatus: "send",
        smsStatus: "send",
        facilityId: facilityId,
      };
    }
  }

  // Function to format the from field with sender name
  formatFromField(senderEmail, senderName = null) {
    if (senderName && senderName.trim() !== "") {
      const escapedName = senderName.replace(/"/g, '\\"');
      return `"${escapedName}" <${senderEmail}>`;
    }
    return senderEmail;
  }

  // Function to get email settings with fallback to defaults
  async getEmailSettings(facilityId) {
    try {
      if (!facilityId) {
        console.log("No facility ID provided, using default email settings");
        return {
          success: true,
          data: emailConfig,
          source: "default",
        };
      }

      console.log(
        "Attempting to fetch email settings for facility:",
        facilityId,
      );

      const response = await axios.get(
        `${BACKEND_URL}/api/app/settings_management/get_email_settings/${facilityId}`,
        { timeout: 10000 },
      );

      if (response.data && response.data.success && response.data.data) {
        console.log(
          "✅ Successfully retrieved facility-specific email settings",
        );
        return {
          ...response.data,
          source: "facility",
        };
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to fetch facility email settings, falling back to defaults",
      );
      console.warn("Error details:", error.message);

      if (
        !emailConfig.sender ||
        !emailConfig.host ||
        !emailConfig.user ||
        !emailConfig.pass
      ) {
        console.error(
          "❌ Default email configuration is incomplete in .env file",
        );
        throw new Error(
          "Both facility-specific and default email configurations are unavailable",
        );
      }

      console.log("✅ Using default email configuration");
      return {
        success: true,
        data: emailConfig,
        source: "default",
      };
    }
  }

  // Main function to handle email sending based on facility status
  async sendEmail(
    facilityId,
    to,
    subject,
    text,
    html = null,
    senderName = null,
  ) {
    try {
      console.log("\n=== Starting Email Process ===");

      // Use default facility ID if not provided
      const finalFacilityId = facilityId || DEFAULT_EMAIL_FACILITY_ID;
      console.log("Using facility ID:", finalFacilityId);

      // Check facility email status
      if (!finalFacilityId) {
        throw new Error("Facility ID is required");
      }

      const facilityStatus = await this.getFacilityStatus(finalFacilityId);
      console.log("Facility email status:", facilityStatus.emailStatus);

      if (facilityStatus.emailStatus === "hold") {
        console.log(
          "🔒 Facility email status is ON HOLD - adding email to internal queue",
        );

        // Add email to internal database queue (EmailSmsService)
        // Add email to internal queue via API when on hold
        const emailData = {
          to,
          subject,
          text:
            text ||
            `${subject}\n\n${html ? "Please view this email with an HTML-capable client." : ""}`,
          html,
          senderName,
        };

        let queuedEmail;
        try {
          // Use the API endpoint to add to queue
          const queueResponse = await axios.post(
            `${BACKEND_URL}/api/emailSmsqueue/${finalFacilityId}/email`,
            emailData,
            { timeout: 5000 },
          );

          queuedEmail = queueResponse.data;
          console.log("✅ Email added to internal queue via API successfully!");
        } catch (queueError) {
          console.error(
            "Failed to add email to queue via API:",
            queueError.message,
          );
          throw queueError;
        }
        return {
          success: true,
          data: queuedEmail,
          method: "internal_queued",
          reason: "facility_email_on_hold",
          message:
            "Email added to internal queue due to facility email status being on hold",
        };
      } else if (facilityStatus.emailStatus === "send") {
        console.log(
          "📧 Facility email status is SEND - sending email directly",
        );

        // Send email directly
        const result = await this.sendDirectEmail(
          finalFacilityId,
          to,
          subject,
          text,
          html,
          senderName,
        );

        console.log("✅ Email sent successfully!");
        return {
          success: true,
          data: result,
          method: "direct",
          message: "Email sent directly",
        };
      } else {
        throw new Error(`Invalid email status: ${facilityStatus.emailStatus}`);
      }
    } catch (error) {
      console.error("❌ Error in email process:", error.message);
      throw error;
    }
  }

  // Function to send emails to external queue API (your original EMAIL_QUEUE_ENDPOINT)
  async sendEmailToQueue(
    facilityId,
    to,
    subject,
    text,
    html = null,
    priority = "normal",
    senderName = null,
  ) {
    try {
      // Use default facility ID if not provided
      const finalFacilityId = facilityId || DEFAULT_EMAIL_FACILITY_ID;
      console.log("Using facility ID for queue:", finalFacilityId);

      console.log("\n=== Starting Send to External Queue Process ===");

      const emailConfigResponse = await this.getEmailSettings(finalFacilityId);

      // Check facility email status first
      if (facilityId) {
        try {
          const facilityStatus = await this.getFacilityStatus(facilityId);
          console.log("Facility email status:", facilityStatus.emailStatus);

          if (facilityStatus.emailStatus === "hold") {
            console.log(
              "🔒 Facility email status is ON HOLD - adding email to internal queue instead",
            );

            // Add to internal queue via API when on hold
            const emailData = {
              to,
              subject,
              text:
                text ||
                `${subject}\n\n${html ? "Please view this email with an HTML-capable client." : ""}`,
              html,
              senderName,
            };

            let queuedEmail;
            try {
              // Use the API endpoint to add to queue
              const queueResponse = await axios.post(
                `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/email`,
                emailData,
                { timeout: 5000 },
              );

              queuedEmail = queueResponse.data;
              console.log(
                "✅ Email added to internal queue via API successfully!",
              );
            } catch (queueError) {
              console.error(
                "Failed to add email to queue via API:",
                queueError.message,
              );
              throw queueError;
            }
            return {
              success: true,
              data: queuedEmail,
              method: "internal_queued",
              reason: "facility_email_on_hold",
              message:
                "Email added to internal queue due to facility email status being on hold",
            };
          }
        } catch (statusError) {
          console.warn(
            "⚠️ Could not check facility status, proceeding with external queue:",
            statusError.message,
          );
          // Continue with external queue sending if status check fails
        }
      }

      // Continue with external queue sending if status is not on hold
      // Reuse emailConfigResponse from line 247, just get settings with correct facilityId
      const settings = emailConfigResponse.data;

      if (
        !settings.sender ||
        !settings.host ||
        !settings.user ||
        !settings.pass
      ) {
        throw new Error(
          "Incomplete email configuration - missing required fields",
        );
      }

      const fromField = this.formatFromField(settings.sender, senderName);

      const queuePayload = {
        from: fromField,
        to,
        subject,
        text,
        ...(html && { html }),
        emailConfig: {
          host: settings.host,
          port: parseInt(settings.port) || 587,
          secure: settings.secure === "true" || settings.secure === true,
          user: settings.user,
          pass: settings.pass,
          rejectUnauthorized: settings.rejectUnauthorized !== "false",
        },
        priority,
        maxRetries: 3,
      };

      console.log("Adding email to external queue:", EMAIL_QUEUE_ENDPOINT);
      const response = await axios.post(EMAIL_QUEUE_ENDPOINT, queuePayload, {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      console.log("✅ Email added to external queue successfully!");
      return {
        success: true,
        data: response.data,
        method: "external_queued",
        configSource: emailConfigResponse.source,
      };
    } catch (error) {
      console.error("\n❌ Error sending email to external queue");
      console.error("Error message:", error.message);
      throw error;
    }
  }

  // Function to send email with automatic fallback and hold check (your original logic)
  async sendEmailWithFallback(
    facilityId,
    to,
    subject,
    text,
    html = null,
    senderName = null,
  ) {
    try {
      // The hold check is already built into sendDirectEmail
      const response = await this.sendDirectEmail(
        facilityId,
        to,
        subject,
        text,
        html,
        senderName,
      );

      // If email was held, return the held response
      if (response.method === "held") {
        return response;
      }

      console.log("✅ Email sent successfully via direct method");
      return response;
    } catch (error) {
      // If rate limited (429) or server overloaded (503), fallback to external queue
      if (
        error.response &&
        (error.response.status === 429 || error.response.status === 503)
      ) {
        console.log(
          "⚠️ Direct email failed due to rate limiting, falling back to external queue...",
        );
        const queueResponse = await this.sendEmailToQueue(
          finalFacilityId,
          to,
          subject,
          text,
          html,
          "high",
          senderName,
        );
        console.log("✅ Email successfully processed via external queue");
        return queueResponse;
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Function to send direct emails
  async sendDirectEmail(
    facilityId,
    to,
    subject,
    text,
    html = null,
    senderName = null,
  ) {
    try {
      // Use default facility ID if not provided
      const finalFacilityId = facilityId || DEFAULT_EMAIL_FACILITY_ID;
      console.log("Using facility ID:", finalFacilityId);

      const emailConfigResponse = await this.getEmailSettings(finalFacilityId);
      console.log("Email config source:", emailConfigResponse.source);

      const settings = emailConfigResponse.data;

      if (
        !settings.sender ||
        !settings.host ||
        !settings.user ||
        !settings.pass
      ) {
        throw new Error(
          "Incomplete email configuration - missing required fields",
        );
      }

      const fromField = this.formatFromField(settings.sender, senderName);

      console.log("Using email settings:");
      console.log("- Host:", settings.host);
      console.log("- Port:", settings.port);
      console.log("- From field:", fromField);
      console.log("- User:", settings.user);
      console.log("- Source:", emailConfigResponse.source);

      const emailPayload = {
        facilityId: finalFacilityId,
        from: fromField,
        to,
        subject,
        text,
        ...(html && { html }),
        emailConfig: {
          host: settings.host,
          port: parseInt(settings.port) || 587,
          secure: settings.secure === "true" || settings.secure === true,
          user: settings.user,
          pass: settings.pass,
          rejectUnauthorized: settings.rejectUnauthorized !== "false",
        },
      };

      console.log("Sending direct email to endpoint:", DIRECT_EMAIL_ENDPOINT);
      const response = await axios.post(DIRECT_EMAIL_ENDPOINT, emailPayload, {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      return response.data;
    } catch (error) {
      console.error("❌ Error sending direct email:", error.message);
      throw error;
    }
  }

  // Function to get queued emails for a facility
  async getQueuedEmails(facilityId) {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/emails`,
        { timeout: 5000 },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get queued emails via API:", error.message);
      throw error;
    }
  }

  async deleteQueuedEmail(facilityId, emailId) {
    try {
      const response = await axios.delete(
        `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/email/${emailId}`,
        { timeout: 5000 },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to delete queued email via API:", error.message);
      throw error;
    }
  }

  async updateQueuedEmail(facilityId, emailId, updateData) {
    try {
      const response = await axios.put(
        `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/email/${emailId}`,
        updateData,
        { timeout: 5000 },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to update queued email via API:", error.message);
      throw error;
    }
  }
}

const enhancedEmailService = new EnhancedEmailService();

// Export the service and individual functions
module.exports = {
  enhancedEmailService,

  // Convenience functions
  async sendEmail(
    facilityId,
    to,
    subject,
    text,
    html = null,
    senderName = null,
  ) {
    return await enhancedEmailService.sendEmail(
      facilityId,
      to,
      subject,
      text,
      html,
      senderName,
    );
  },

  async sendDirectEmail(
    facilityId,
    to,
    subject,
    text,
    html = null,
    senderName = null,
  ) {
    return await enhancedEmailService.sendDirectEmail(
      facilityId,
      to,
      subject,
      text,
      html,
      senderName,
    );
  },

  async sendEmailToQueue(
    facilityId,
    to,
    subject,
    text = null,
    html = null,
    priority = "normal",
    senderName = null,
  ) {
    // Ensure text is provided - generate from subject if missing
    const plainText =
      text ||
      `${subject}\n\n${html ? "Please view this email with an HTML-capable client." : ""}`;

    return await enhancedEmailService.sendEmailToQueue(
      facilityId,
      to,
      subject,
      plainText,
      html,
      priority,
      senderName,
    );
  },

  async sendEmailWithFallback(
    facilityId,
    to,
    subject,
    text,
    html = null,
    senderName = null,
  ) {
    return await enhancedEmailService.sendEmailWithFallback(
      facilityId,
      to,
      subject,
      text,
      html,
      senderName,
    );
  },

  async getQueuedEmails(facilityId) {
    return await enhancedEmailService.getQueuedEmails(facilityId);
  },

  async deleteQueuedEmail(facilityId, emailId) {
    return await enhancedEmailService.deleteQueuedEmail(facilityId, emailId);
  },

  async updateQueuedEmail(facilityId, emailId, updateData) {
    return await enhancedEmailService.updateQueuedEmail(
      facilityId,
      emailId,
      updateData,
    );
  },
};
