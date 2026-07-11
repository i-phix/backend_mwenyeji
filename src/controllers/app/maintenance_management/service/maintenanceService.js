const cron = require("node-cron");
const { getModel } = require("../../../../utils/getModel");
const { sendSms } = require("../../../../utils/send_new_sms");
const { sendEmail } = require("../../../../utils/send_new_email");
const payservedb = require("payservedb");

class MaintenanceService {
  constructor() {
    this.isRunning = false;
    this.isInitialized = false;
  }

  async waitForConnection(maxRetries = 10, retryDelay = 10000) {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Use payservedb.Facility directly - it's the main database, not facility-specific
        await payservedb.Facility.findOne({});
        return true;
      } catch (error) {
        retries++;
        console.error("Connection error:", error.message);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    console.error(
      "Failed to establish database connection after maximum retries. Running in degraded mode.",
    );
    return false;
  }

  async hasExistingWorkOrder(
    workOrderModel,
    facilityId,
    vendorId,
    serviceType,
  ) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const existingWorkOrder = await workOrderModel.findOne({
      facilityId,
      requester: vendorId,
      description: new RegExp(
        `${serviceType}.*${today.toISOString().split("T")[0]}`,
      ),
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    return !!existingWorkOrder;
  }

  async createMaintenanceWorkOrder(facilityId, serviceVendor) {
    try {
      const workOrderModel = await getModel(
        "WorkOrder",
        payservedb.WorkOrder.schema,
        facilityId,
      );

      const exists = await this.hasExistingWorkOrder(
        workOrderModel,
        facilityId,
        serviceVendor._id,
        serviceVendor.service,
      );

      if (exists) {
        return null;
      }

      const orderNumber = Math.floor(Math.random() * 1000000);
      const today = new Date().toISOString().split("T")[0];

      const workOrder = await workOrderModel.create({
        facilityId,
        requester: serviceVendor._id,
        assigneeName: serviceVendor.name,
        description: `Scheduled maintenance for ${serviceVendor.name} - ${serviceVendor.service} for date: ${today}`,
        pricing: 0,
        status: "pending",
        type: "scheduled",
        orderNumber,
      });

      return workOrder;
    } catch (error) {
      console.error("Error creating maintenance work order:", error.message);
      return null;
    }
  }

  async sendMaintenanceReminder(
    serviceVendor,
    daysUntilMaintenance,
    facilityId,
  ) {
    try {
      const maintenanceDate = new Date(
        serviceVendor.dates[0],
      ).toLocaleDateString();
      const message =
        daysUntilMaintenance === 5
          ? `Reminder: You have scheduled maintenance in 5 days on ${maintenanceDate} for ${serviceVendor.service}. Please prepare accordingly.`
          : `Reminder: You have scheduled maintenance tomorrow on ${maintenanceDate} for ${serviceVendor.service}. Please ensure you're prepared.`;

      const results = {
        sms: { success: false, error: null },
        email: { success: false, error: null },
      };

      // Send SMS if service vendor has phone number
      if (serviceVendor.phone) {
        try {
          const smsResponse = await sendSms(
            facilityId,
            serviceVendor.phone,
            message,
          );
          console.log("SMS Response:", smsResponse);

          if (smsResponse && smsResponse.success) {
            results.sms.success = true;
            console.log(
              `SMS maintenance reminder sent successfully to ${serviceVendor.phone}`,
            );
          } else {
            results.sms.error = "SMS response indicates failure";
            console.log(
              `SMS maintenance reminder may have failed for ${serviceVendor.phone}:`,
              smsResponse,
            );
          }
        } catch (smsError) {
          results.sms.error = smsError.message;
          console.error(
            `Error sending SMS maintenance reminder to ${serviceVendor.phone}: ${smsError.message}`,
          );
        }
      }

      // Send Email if service vendor has email
      if (serviceVendor.email) {
        try {
          const emailResponse = await sendEmail(
            facilityId,
            serviceVendor.email,
            "Maintenance Reminder",
            message,
          );

          if (emailResponse && emailResponse.success) {
            results.email.success = true;
            console.log(
              `Email maintenance reminder sent successfully to ${serviceVendor.email}`,
            );
          } else {
            results.email.error = "Email response indicates failure";
            console.log(
              `Email maintenance reminder may have failed for ${serviceVendor.email}:`,
              emailResponse,
            );
          }
        } catch (emailError) {
          results.email.error = emailError.message;
          console.error(
            `Error sending Email maintenance reminder to ${serviceVendor.email}: ${emailError.message}`,
          );
        }
      }

      // Log overall results
      const sentMethods = [];
      if (results.sms.success) sentMethods.push("SMS");
      if (results.email.success) sentMethods.push("Email");

      if (sentMethods.length > 0) {
        console.log(
          `Maintenance reminder sent successfully via: ${sentMethods.join(", ")} for vendor ${serviceVendor._id}`,
        );
      } else {
        console.error(
          `All maintenance reminder methods failed for vendor ${serviceVendor._id}. SMS: ${results.sms.error || "not attempted"}, Email: ${results.email.error || "not attempted"}`,
        );
      }
    } catch (error) {
      console.error("Error sending maintenance reminder:", error.message);
    }
  }

  async checkUpcomingMaintenance() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const connected = await this.waitForConnection();
      if (!connected) {
        console.log(
          "Skipping upcoming maintenance check due to database connection issues",
        );
        return;
      }

      // Use payservedb.Facility directly - it's the main database, not facility-specific
      const facilities = await payservedb.Facility.find({});

      const today = new Date();
      const fiveDaysFromNow = new Date(today);
      fiveDaysFromNow.setDate(today.getDate() + 5);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      for (const facility of facilities) {
        const serviceVendorModel = await getModel(
          "ServiceVendor",
          payservedb.ServiceVendor.schema,
          facility._id,
        );

        // Create date objects that won't be modified in subsequent iterations
        const fiveDayStart = new Date(fiveDaysFromNow);
        fiveDayStart.setHours(0, 0, 0, 0);
        const fiveDayEnd = new Date(fiveDaysFromNow);
        fiveDayEnd.setHours(23, 59, 59, 999);

        const tomorrowStart = new Date(tomorrow);
        tomorrowStart.setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);

        // Check for vendors with maintenance in 5 days
        const vendorsIn5Days = await serviceVendorModel.find({
          facilityId: facility._id,
          dates: {
            $elemMatch: {
              $gte: fiveDayStart,
              $lte: fiveDayEnd,
            },
          },
        });

        // Check for vendors with maintenance tomorrow
        const vendorsTomorrow = await serviceVendorModel.find({
          facilityId: facility._id,
          dates: {
            $elemMatch: {
              $gte: tomorrowStart,
              $lte: tomorrowEnd,
            },
          },
        });

        // Send 5-day reminders
        for (const vendor of vendorsIn5Days) {
          await this.sendMaintenanceReminder(vendor, 5, facility._id);
        }

        // Send day-before reminders
        for (const vendor of vendorsTomorrow) {
          await this.sendMaintenanceReminder(vendor, 1, facility._id);
        }
      }
    } catch (error) {
      console.error("Error checking upcoming maintenance:", error);
    } finally {
      this.isRunning = false;
    }
  }

  async checkMaintenanceSchedules() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const connected = await this.waitForConnection();
      if (!connected) {
        console.log(
          "Skipping maintenance schedules check due to database connection issues",
        );
        return;
      }

      // Use payservedb.Facility directly - it's the main database, not facility-specific
      const facilities = await payservedb.Facility.find({});
      const today = new Date();

      for (const facility of facilities) {
        const serviceVendorModel = await getModel(
          "ServiceVendor",
          payservedb.ServiceVendor.schema,
          facility._id,
        );

        // Create fresh date objects that won't be modified by later operations
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const serviceVendors = await serviceVendorModel.find({
          facilityId: facility._id,
          dates: {
            $elemMatch: {
              $gte: todayStart,
              $lte: todayEnd,
            },
          },
        });

        for (const vendor of serviceVendors) {
          await this.createMaintenanceWorkOrder(facility._id, vendor);
        }
      }
    } catch (error) {
      console.error("Error checking maintenance schedules:", error);
    } finally {
      this.isRunning = false;
    }
  }

  async initialize() {
    // Don't throw an error if initial connection fails
    // Just log it and continue with degraded functionality
    try {
      const connected = await this.waitForConnection();

      if (!connected) {
        console.warn(
          "MaintenanceService initialized with degraded functionality due to database connection issues",
        );
      } else {
      }

      // Schedule maintenance work order creation at 12:30 AM daily
      cron.schedule("30 00 * * *", async () => {
        console.log("Running scheduled maintenance check");
        await this.checkMaintenanceSchedules();
      });

      // Schedule reminder checks at 3:00 PM (15:00)
      cron.schedule("00 15 * * *", async () => {
        await this.checkUpcomingMaintenance();
      });

      this.isInitialized = true;
    } catch (error) {
      console.error("Error during MaintenanceService initialization:", error);
      // Important: Don't exit the process here
      this.isInitialized = false; // Mark as not initialized so we can try again later if needed
    }
  }
}

module.exports = new MaintenanceService();
