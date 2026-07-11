const axios = require("axios");
require("dotenv").config();
const { smsSettings } = require("./communication_defaults");
const EmailSmsService = require("./emailSmsService");

const BACKEND_URL = process.env.BACKEND_URL;
const COMMUNICATIONS_ENDPOINT = process.env.COMMUNICATIONS_ENDPOINT;
const DIRECT_SMS_ENDPOINT = `${COMMUNICATIONS_ENDPOINT}/api/sms/send`;
const SMS_QUEUE_ENDPOINT = `${COMMUNICATIONS_ENDPOINT}/api/sms-queue/queue`;
const DEFAULT_SMS_FACILITY_ID = process.env.DEFAULT_SMS_FACILITY_ID;

// Service class to handle facility status and SMS queue management
class EnhancedSmsService {
  constructor() {
    this.emailSmsService = new EmailSmsService();
  }

  // Removed direct DB model access in favor of API endpoints
  async getCommunicationStatusModel(facilityId) {
    console.log(
      "Warning: getCommunicationStatusModel is deprecated, use getFacilityStatus instead",
    );
    return null;
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

  // Function to get SMS settings with fallback to defaults
  async getSmsSettings(facilityId) {
    try {
      // If no facilityId provided, use default settings
      if (!facilityId) {
        console.log("No facility ID provided, using default SMS settings");
        return {
          success: true,
          data: smsSettings,
          source: "default",
        };
      }

      console.log("Attempting to fetch SMS settings for facility:", facilityId);

      // Try to get facility-specific settings
      const response = await axios.get(
        `${BACKEND_URL}/api/app/settings_management/get_sms_settings/${facilityId}`,
        { timeout: 10000 }, // 10 second timeout
      );

      // Handle both response formats:
      // 1. {success: true, data: {...}} - older format
      // 2. {message: "...", data: {...}} - current format
      if (
        response.data &&
        ((response.data.success && response.data.data) ||
          (response.data.message && response.data.data))
      ) {
        console.log("✅ Successfully retrieved facility-specific SMS settings");
        return {
          success: true, // Ensure success is set
          data: response.data.data,
          source: "facility",
          message: response.data.message || "SMS settings retrieved",
        };
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to fetch facility SMS settings, falling back to defaults",
      );
      console.warn("Error details:", error.message);

      // Fallback to default settings
      if (!smsSettings.senderId || !smsSettings.apiKey) {
        console.error(
          "❌ Default SMS configuration is incomplete in .env file",
        );
        console.error("Missing fields:", {
          senderId: !smsSettings.senderId,
          apiKey: !smsSettings.apiKey,
        });
        throw new Error(
          "Both facility-specific and default SMS configurations are unavailable",
        );
      }

      console.log("✅ Using default SMS configuration");
      return {
        success: true,
        data: smsSettings,
        source: "default",
      };
    }
  }

  // Main function to handle SMS sending based on facility status
  async sendSms(facilityId, phoneNumber, message) {
    try {
      console.log("\n=== Starting SMS Process ===");

      // Use default facility ID if not provided
      const finalFacilityId = facilityId || DEFAULT_SMS_FACILITY_ID;
      console.log("Using facility ID:", finalFacilityId);

      // Check facility SMS status
      if (!finalFacilityId) {
        throw new Error("Facility ID is required");
      }

      let facilityStatus;
      try {
        facilityStatus = await this.getFacilityStatus(finalFacilityId);
        console.log("Facility SMS status:", facilityStatus.smsStatus);
      } catch (statusError) {
        console.warn(
          "Could not retrieve facility status, assuming 'send':",
          statusError.message,
        );
        facilityStatus = {
          smsStatus: "send",
          emailStatus: "send",
          facilityId: finalFacilityId,
        };
      }

      if (facilityStatus.smsStatus === "hold") {
        console.log("🔒 Facility SMS status is ON HOLD - adding SMS to queue");

        // Add SMS to EmailSmsService queue
        const smsData = {
          to: phoneNumber,
          message: message,
        };

        const queuedSms = await this.emailSmsService.addSmsToQueue(
          finalFacilityId,
          smsData,
        );

        console.log("✅ SMS added to queue successfully!");
        return {
          success: true,
          data: queuedSms,
          method: "queued",
          reason: "facility_sms_on_hold",
          message:
            "SMS added to queue due to facility SMS status being on hold",
        };
      } else if (facilityStatus.smsStatus === "send") {
        console.log("📱 Facility SMS status is SEND - sending SMS directly");

        // Send SMS directly
        const result = await this.sendDirectSms(
          finalFacilityId,
          phoneNumber,
          message,
        );

        console.log("✅ SMS sent successfully!");
        return {
          success: true,
          data: result,
          method: "direct",
          message: "SMS sent directly",
        };
      } else {
        throw new Error(`Invalid SMS status: ${facilityStatus.smsStatus}`);
      }
    } catch (error) {
      console.error("❌ Error in SMS process:", error.message);
      throw error;
    }
  }

  // Function to send SMS directly
  async sendDirectSms(facilityId, phoneNumber, message) {
    try {
      console.log("\n=== Starting Direct SMS Process ===");

      // Use default facility ID if not provided
      const finalFacilityId = facilityId || DEFAULT_SMS_FACILITY_ID;
      console.log("Using facility ID:", finalFacilityId);

      // Get SMS settings (with fallback)
      const settingsResponse = await this.getSmsSettings(finalFacilityId);
      console.log("SMS config source:", settingsResponse.source);
      console.log("SMS config fetched successfully:", settingsResponse.success);

      const settings = settingsResponse.data;

      // Validate required settings
      if (!settings.senderId || !settings.apiKey) {
        throw new Error(
          "Incomplete SMS configuration - missing senderId or apiKey",
        );
      }

      console.log("Using SMS settings:");
      console.log("- Sender ID:", settings.senderId);
      console.log(
        "- API Key:",
        settings.apiKey ? "***configured***" : "missing",
      );
      console.log("- Source:", settingsResponse.source);

      // Prepare payload for SMS API
      const smsPayload = {
        facilityId: finalFacilityId,
        from: settings.senderId,
        to: phoneNumber,
        message: message,
        token: settings.apiKey,
      };

      console.log("SMS payload prepared:");
      console.log("- From:", smsPayload.from);
      console.log("- To:", smsPayload.to);
      console.log("- Message length:", smsPayload.message.length);

      // Send SMS using the PayServe communications API
      console.log("Sending SMS to endpoint:", DIRECT_SMS_ENDPOINT);
      const smsResponse = await axios.post(DIRECT_SMS_ENDPOINT, smsPayload, {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      console.log("✅ SMS sent successfully!");
      console.log("Response status:", smsResponse.status);
      console.log("Response data:", smsResponse.data);

      return smsResponse.data;
    } catch (error) {
      console.error("\n❌ Error sending direct SMS");
      console.error("Error type:", error.constructor.name);
      console.error("Error message:", error.message);

      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      } else if (error.request) {
        console.error("No response received from SMS service");
        console.error("Request URL:", error.config?.url);
      }

      throw error;
    }
  }

  // Function to send SMS to external queue
  async sendSmsToQueue(facilityId, phoneNumber, message, priority = "normal") {
    try {
      // Use default facility ID if not provided
      const finalFacilityId = facilityId || DEFAULT_SMS_FACILITY_ID;
      console.log("Using facility ID for queue:", finalFacilityId);

      // Check facility SMS status first
      if (finalFacilityId) {
        try {
          const facilityStatus = await this.getFacilityStatus(finalFacilityId);
          console.log("Facility SMS status:", facilityStatus.smsStatus);

          if (facilityStatus.smsStatus === "hold") {
            console.log(
              "🔒 Facility SMS status is ON HOLD - adding SMS to internal queue instead",
            );

            // Add to internal queue via API when on hold
            const smsData = {
              to: phoneNumber,
              message: message,
            };

            try {
              // Use the API endpoint to add to queue
              const queueResponse = await axios.post(
                `${BACKEND_URL}/api/emailSmsqueue/${finalFacilityId}/sms`,
                smsData,
                { timeout: 5000 },
              );

              const queuedSms = queueResponse.data;
              console.log(
                "✅ SMS added to internal queue via API successfully!",
              );
              return {
                success: true,
                data: queuedSms,
                method: "internal_queued",
                reason: "facility_sms_on_hold",
                message:
                  "SMS added to internal queue due to facility SMS status being on hold",
              };
            } catch (queueError) {
              console.error(
                "Failed to add SMS to queue via API:",
                queueError.message,
              );
              throw queueError;
            }
          }
        } catch (statusError) {
          console.warn(
            "⚠️ Could not check facility status, proceeding with external queue:",
            statusError.message,
          );
          // Continue with external queue sending if status check fails
        }
      }

      console.log("\n=== Starting Queue SMS Process ===");

      // Get SMS settings (with fallback)
      const settingsResponse = await this.getSmsSettings(finalFacilityId);
      console.log("Queue - SMS config source:", settingsResponse.source);
      console.log(
        "Queue - SMS config fetched successfully:",
        settingsResponse.success,
      );

      const settings = settingsResponse.data;

      // Validate required settings
      if (!settings.senderId || !settings.apiKey) {
        throw new Error(
          "Incomplete SMS configuration - missing senderId or apiKey",
        );
      }

      console.log("Queue - Using SMS settings:");
      console.log("- Sender ID:", settings.senderId);
      console.log(
        "- API Key:",
        settings.apiKey ? "***configured***" : "missing",
      );
      console.log("- Source:", settingsResponse.source);

      // Prepare payload for SMS queue
      const smsQueuePayload = {
        facilityId: finalFacilityId,
        from: settings.senderId,
        to: phoneNumber,
        message: message,
        token: settings.apiKey,
        priority: priority,
        maxRetries: 3,
      };

      console.log("Queue payload prepared:");
      console.log("- From:", smsQueuePayload.from);
      console.log("- To:", smsQueuePayload.to);
      console.log("- Message length:", smsQueuePayload.message.length);
      console.log("- Priority:", smsQueuePayload.priority);

      console.log("Adding SMS to external queue:", SMS_QUEUE_ENDPOINT);
      const queueResponse = await axios.post(
        SMS_QUEUE_ENDPOINT,
        smsQueuePayload,
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      console.log("✅ SMS added to external queue successfully!");
      console.log("Response status:", queueResponse.status);
      console.log("Response data:", queueResponse.data);

      return {
        success: true,
        data: queueResponse.data,
        method: "external_queued",
        configSource: settingsResponse.source,
      };
    } catch (error) {
      console.error("\n❌ Error sending SMS to external queue");
      console.error("Error type:", error.constructor.name);
      console.error("Error message:", error.message);

      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      } else if (error.request) {
        console.error("No response received from queue service");
        console.error("Request URL:", error.config?.url);
      }

      throw error;
    }
  }

  // Function to send SMS with automatic fallback and hold check
  async sendSmsWithFallback(facilityId, phoneNumber, message) {
    try {
      // The hold check is already built into sendSms
      const response = await this.sendSms(facilityId, phoneNumber, message);

      // If SMS was held, return the held response
      if (response.method === "queued") {
        return response;
      }

      console.log("✅ SMS sent successfully via direct method");
      return response;
    } catch (error) {
      // If rate limited (429) or server overloaded (503), fallback to external queue
      if (
        error.response &&
        (error.response.status === 429 || error.response.status === 503)
      ) {
        console.log(
          "⚠️ Direct SMS failed due to rate limiting, falling back to queue...",
        );
        const queueResponse = await this.sendSmsToQueue(
          finalFacilityId,
          phoneNumber,
          message,
          "high",
        );
        console.log("✅ SMS successfully processed via external queue");
        return queueResponse;
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Function to get queued SMS for a facility via API
  async getQueuedSms(facilityId) {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/sms`,
        { timeout: 5000 },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get queued SMS via API:", error.message);
      throw error;
    }
  }

  // Function to delete a specific queued SMS via API
  async deleteQueuedSms(facilityId, smsId) {
    try {
      const response = await axios.delete(
        `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/sms/${smsId}`,
        { timeout: 5000 },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to delete queued SMS via API:", error.message);
      throw error;
    }
  }

  // Function to update a queued SMS via API
  async updateQueuedSms(facilityId, smsId, updateData) {
    try {
      const response = await axios.put(
        `${BACKEND_URL}/api/emailSmsqueue/${facilityId}/sms/${smsId}`,
        updateData,
        { timeout: 5000 },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to update queued SMS via API:", error.message);
      throw error;
    }
  }
}

const enhancedSmsService = new EnhancedSmsService();

// Export the service and individual functions
module.exports = {
  enhancedSmsService,

  // Convenience functions
  async sendSms(facilityId, phoneNumber, message) {
    return await enhancedSmsService.sendSms(facilityId, phoneNumber, message);
  },

  async sendDirectSms(facilityId, phoneNumber, message) {
    return await enhancedSmsService.sendDirectSms(
      facilityId,
      phoneNumber,
      message,
    );
  },

  async sendSmsToQueue(facilityId, phoneNumber, message, priority = "normal") {
    return await enhancedSmsService.sendSmsToQueue(
      facilityId,
      phoneNumber,
      message,
      priority,
    );
  },

  async sendSmsWithFallback(facilityId, phoneNumber, message) {
    return await enhancedSmsService.sendSmsWithFallback(
      facilityId,
      phoneNumber,
      message,
    );
  },

  async getQueuedSms(facilityId) {
    return await enhancedSmsService.getQueuedSms(facilityId);
  },

  async deleteQueuedSms(facilityId, smsId) {
    return await enhancedSmsService.deleteQueuedSms(facilityId, smsId);
  },

  async updateQueuedSms(facilityId, smsId, updateData) {
    return await enhancedSmsService.updateQueuedSms(
      facilityId,
      smsId,
      updateData,
    );
  },

  // Legacy functions for backward compatibility
  getSmsSettings: enhancedSmsService.getSmsSettings.bind(enhancedSmsService),
};

// Usage examples:
/*
// Basic SMS sending (automatically handles hold/send logic)
const result = await sendSms(
  "68354b430bfa0b7ac72078c5",
  "254714301107",
  "Test SMS message"
);

// If facility status is "hold", result will be:
// {
//   success: true,
//   method: "queued",
//   reason: "facility_sms_on_hold",
//   message: "SMS added to queue due to facility SMS status being on hold"
// }

// If facility status is "send", result will be:
// {
//   success: true,
//   method: "direct",
//   message: "SMS sent directly"
// }

// Direct SMS sending (with hold check built-in)
const result = await sendDirectSms(
  "68354b430bfa0b7ac72078c5",
  "254714301107",
  "Test SMS message"
);

// Send to external queue (with hold check - will use internal queue if on hold)
const result = await sendSmsToQueue(
  "68354b430bfa0b7ac72078c5",
  "254714301107",
  "Test SMS message",
  "high"
);

// Send with automatic fallback (direct -> external queue on rate limit)
const result = await sendSmsWithFallback(
  "68354b430bfa0b7ac72078c5",
  "254714301107",
  "Test SMS message"
);

// Get all queued SMS for a facility:
const queuedSms = await getQueuedSms("68354b430bfa0b7ac72078c5");

// Delete a specific queued SMS:
await deleteQueuedSms("68354b430bfa0b7ac72078c5", "sms_id_here");

// Update a queued SMS:
await updateQueuedSms("68354b430bfa0b7ac72078c5", "sms_id_here", {
  to: "254700000000",
  message: "Updated SMS message"
});
*/
