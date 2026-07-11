const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const addDutyRoster = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      // Staff reference and position
      staffId,
      staffPosition = "Normal",
      masterWorkplanId,

      // Date range for roster validity
      startDate,
      endDate,

      // Weekly schedule
      weeklySchedule,

      // Exceptions
      exceptions,

      // Metadata
      metadata,

      // Checklist generation options
      checklistOptions = {
        generateChecklist: true,
        taskFrequency: "daily", // daily, weekly, monthly, custom
        customDates: null, // array of specific dates if frequency is custom
      },
    } = request.body;

    // Basic validation
    if (!staffId) {
      return reply.status(400).send({
        success: false,
        error: "staffId is required",
      });
    }

    if (!masterWorkplanId) {
      return reply.status(400).send({
        success: false,
        error: "masterWorkplanId is required",
      });
    }

    if (!startDate || !endDate) {
      return reply.status(400).send({
        success: false,
        error: "startDate and endDate are required",
      });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return reply.status(400).send({
        success: false,
        error: "End date must be after start date",
      });
    }

    // Validate staffPosition
    if (!["Head", "Deputy", "Assistant", "Normal"].includes(staffPosition)) {
      return reply.status(400).send({
        success: false,
        error:
          "Invalid staffPosition. Must be one of: Head, Deputy, Assistant, Normal",
      });
    }

    // Verify that the staff user exists using the global User model
    const staffUser = await payservedb.User.findById(staffId);
    if (!staffUser) {
      return reply.status(400).send({
        success: false,
        error: "Staff user not found",
      });
    }

    if (!weeklySchedule) {
      return reply.status(400).send({
        success: false,
        error: "Weekly schedule is required",
      });
    }

    // Validate weekly schedule has required days
    const requiredDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    const processedWeeklySchedule = {};

    for (const day of requiredDays) {
      if (!weeklySchedule[day]) {
        // If day is not provided, set default OFF schedule
        processedWeeklySchedule[day] = [
          {
            startTime: "",
            endTime: "",
            status: "OFF",
          },
        ];
      } else {
        // Ensure each day has time slots as an array
        if (!Array.isArray(weeklySchedule[day])) {
          // Convert old format to new array format
          processedWeeklySchedule[day] = [
            {
              startTime: weeklySchedule[day].startTime || "",
              endTime: weeklySchedule[day].endTime || "",
              status: weeklySchedule[day].status || "ON",
            },
          ];
        } else {
          processedWeeklySchedule[day] = weeklySchedule[day];
        }

        // Validate each time slot
        for (const slot of processedWeeklySchedule[day]) {
          if (
            slot.status &&
            !["ON", "OFF", "AL", "CL", "ML/PL", "PH", "UI"].includes(
              slot.status,
            )
          ) {
            return reply.status(400).send({
              success: false,
              error: `Invalid status "${slot.status}" for ${day}`,
            });
          }
        }
      }
    }

    // Validate exceptions if provided
    const processedExceptions = [];
    if (exceptions && Array.isArray(exceptions)) {
      for (const item of exceptions) {
        if (!item.date || !item.status) {
          return reply.status(400).send({
            success: false,
            error: "Each exception must have a date and status",
          });
        }

        if (
          !["ON", "OFF", "AL", "CL", "ML/PL", "PH", "UI"].includes(item.status)
        ) {
          return reply.status(400).send({
            success: false,
            error: `Invalid exception status "${item.status}"`,
          });
        }

        processedExceptions.push({
          date: new Date(item.date),
          startTime: item.startTime || "",
          endTime: item.endTime || "",
          status: item.status,
          reason: item.reason || "",
        });
      }
    }

    // Get the duty roster model for this facility
    const dutyRosterModel = await getModel(
      "DutyRoster",
      payservedb.DutyRoster.schema,
      facilityId,
    );

    // Get the master workplan model for validation
    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );

    // Verify that the master workplan exists
    const masterWorkplan = await masterWorkplanModel.findById(masterWorkplanId);
    if (!masterWorkplan) {
      return reply.status(400).send({
        success: false,
        error: "Master workplan not found",
      });
    }

    // Create the duty roster entry
    const newEntry = await dutyRosterModel.create({
      facilityId,
      staffId,
      staffPosition,
      masterWorkplanId,
      startDate: start,
      endDate: end,
      weeklySchedule: processedWeeklySchedule,
      exceptions: processedExceptions,
      metadata: metadata
        ? {
            period: metadata.period
              ? {
                  startDate: new Date(metadata.period.startDate),
                  endDate: new Date(metadata.period.endDate),
                }
              : null,
          }
        : { period: null },
    });

    // Create duty roster checklist if requested
    let checklist = null;
    if (checklistOptions.generateChecklist) {
      try {
        checklist = await createDutyRosterChecklist(
          facilityId,
          newEntry._id,
          staffId,
          masterWorkplanId,
          start,
          end,
          checklistOptions,
        );
      } catch (checklistError) {
        console.error("Error creating checklist:", checklistError);
        // Don't fail the entire operation if checklist creation fails
        // Just log the error and continue
      }
    }

    // Manually populate the staff and master workplan details instead of using mongoose populate
    const responseData = {
      ...newEntry.toObject(),
      staffDetails: {
        _id: staffUser._id,
        fullName: staffUser.fullName,
        email: staffUser.email,
        phoneNumber: staffUser.phoneNumber,
        role: staffUser.role,
      },
      masterWorkplanDetails: {
        _id: masterWorkplan._id,
        title: masterWorkplan.title,
        description: masterWorkplan.description,
        life: masterWorkplan.life,
        status: masterWorkplan.status,
      },
      checklist: checklist ? checklist.toObject() : null,
    };

    return reply.status(201).send({
      success: true,
      message: "Duty Roster entry added successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error adding duty roster:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Helper function to create duty roster checklist
const createDutyRosterChecklist = async (
  facilityId,
  dutyRosterId,
  staffId,
  masterWorkplanId,
  startDate,
  endDate,
  options,
) => {
  try {
    console.log("Creating duty roster checklist with options:", options);

    // Get required models - using the correct model names
    const dutyRosterChecklistModel = await getModel(
      "DutyRosterChecklist",
      payservedb.DutyRosterChecklist.schema,
      facilityId,
    );

    // Note: The model is registered as "ChildWorkplan" but exported as MasterWorkplanChild
    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      payservedb.MasterWorkplanChild.schema,
      facilityId,
    );

    console.log("Models retrieved successfully");

    // Get all child workplans for the master workplan
    const childWorkplans = await childWorkplanModel.find({
      parent: masterWorkplanId,
    });

    console.log(
      `Found ${childWorkplans.length} child workplans for master workplan ${masterWorkplanId}`,
    );

    if (childWorkplans.length === 0) {
      throw new Error("No child workplans found for the master workplan");
    }

    // Generate dates based on frequency
    let scheduleDates = [];
    if (options.customDates && Array.isArray(options.customDates)) {
      // Use custom dates provided
      scheduleDates = options.customDates.map((date) => new Date(date));
      console.log("Using custom dates:", scheduleDates);
    } else {
      // Try to use the static method from the model first
      try {
        if (dutyRosterChecklistModel.generateDateRange) {
          scheduleDates = dutyRosterChecklistModel.generateDateRange(
            startDate,
            endDate,
            options.taskFrequency || "daily",
          );
          console.log("Used model static method to generate dates");
        } else {
          throw new Error("Static method not available, using fallback");
        }
      } catch (staticMethodError) {
        console.log(
          "Static method failed, using fallback function:",
          staticMethodError.message,
        );
        // Fallback to our own implementation
        scheduleDates = generateDateRange(
          startDate,
          endDate,
          options.taskFrequency || "daily",
        );
      }
    }

    console.log(
      `Generated ${scheduleDates.length} schedule dates from ${startDate} to ${endDate} with frequency: ${options.taskFrequency || "daily"}`,
    );

    // Create tasks array with child workplans and their scheduled dates
    const tasks = childWorkplans.map((childWorkplan) => ({
      childWorkplanId: childWorkplan._id,
      scheduledDates: scheduleDates.map((date) => ({
        date: new Date(date),
        status: "pending",
        startTime: "",
        endTime: "",
      })),
      priority: "medium",
      isRecurring: options.taskFrequency !== "custom",
      recurringPattern: options.taskFrequency || "daily",
    }));

    console.log(`Created ${tasks.length} tasks with scheduled dates`);

    // Create the checklist
    const checklistData = {
      dutyRosterId,
      facilityId,
      staffId,
      masterWorkplanId,
      tasks,
      period: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      status: "active",
    };

    console.log(
      "Creating checklist with data:",
      JSON.stringify(checklistData, null, 2),
    );

    const checklist = await dutyRosterChecklistModel.create(checklistData);

    console.log("Checklist created successfully:", checklist._id);

    return checklist;
  } catch (error) {
    console.error("Error in createDutyRosterChecklist:", error);
    console.error("Stack trace:", error.stack);
    throw error;
  }
};

// Fallback function to generate date range if static method fails
const generateDateRange = (startDate, endDate, frequency) => {
  console.log(
    `Generating date range from ${startDate} to ${endDate} with frequency ${frequency}`,
  );

  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ensure we don't exceed the end date
  let current = new Date(start);

  switch (frequency) {
    case "daily":
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      break;

    case "weekly":
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }
      break;

    case "monthly":
      while (current <= end) {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }
      break;

    default:
      // Default to daily if frequency is unknown
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      break;
  }

  console.log(`Generated ${dates.length} dates`);
  return dates;
};

module.exports = addDutyRoster;
