const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const editDutyRoster = async (request, reply) => {
  try {
    const { facilityId, rosterId } = request.params;
    const updateData = request.body;

    // Validate ObjectId format
    if (!rosterId.match(/^[0-9a-fA-F]{24}$/)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid roster ID format",
      });
    }

    // Get the models
    const dutyRosterModel = await getModel(
      "DutyRoster",
      payservedb.DutyRoster.schema,
      facilityId,
    );

    const dutyRosterChecklistModel = await getModel(
      "DutyRosterChecklist",
      payservedb.DutyRosterChecklist.schema,
      facilityId,
    );

    // Check if roster exists
    const existingRoster = await dutyRosterModel.findById(rosterId);
    if (!existingRoster) {
      return reply.status(404).send({
        success: false,
        error: "Duty Roster not found",
      });
    }

    // Verify the roster belongs to the specified facility
    if (existingRoster.facilityId.toString() !== facilityId) {
      return reply.status(403).send({
        success: false,
        error: "Unauthorized: Roster does not belong to this facility",
      });
    }

    // Track what changes need checklist updates
    const checklistUpdatesNeeded = {
      staffId: false,
      masterWorkplan: false,
      dateRange: false,
      regenerateChecklist: false,
    };

    // Build update object with proper structure
    const update = {};

    // Handle staffId updates
    if (updateData.staffId) {
      // Verify that the staff user exists
      const staffUser = await payservedb.User.findById(updateData.staffId);
      if (!staffUser) {
        return reply.status(400).send({
          success: false,
          error: "Staff user not found",
        });
      }

      if (updateData.staffId !== existingRoster.staffId.toString()) {
        checklistUpdatesNeeded.staffId = true;
      }
      update.staffId = updateData.staffId;
    }

    // Handle staffPosition updates
    if (updateData.staffPosition) {
      if (
        !["Head", "Deputy", "Assistant", "Normal"].includes(
          updateData.staffPosition,
        )
      ) {
        return reply.status(400).send({
          success: false,
          error:
            "Invalid staffPosition. Must be one of: Head, Deputy, Assistant, Normal",
        });
      }
      update.staffPosition = updateData.staffPosition;
    }

    // Handle masterWorkplanId updates
    if (updateData.masterWorkplanId) {
      if (
        updateData.masterWorkplanId !==
        existingRoster.masterWorkplanId.toString()
      ) {
        checklistUpdatesNeeded.masterWorkplan = true;
        checklistUpdatesNeeded.regenerateChecklist = true;
      }
      update.masterWorkplanId = updateData.masterWorkplanId;
    }

    // Handle date range updates
    if (updateData.startDate || updateData.endDate) {
      const startDate = updateData.startDate
        ? new Date(updateData.startDate)
        : existingRoster.startDate;
      const endDate = updateData.endDate
        ? new Date(updateData.endDate)
        : existingRoster.endDate;

      // Validate date range
      if (startDate >= endDate) {
        return reply.status(400).send({
          success: false,
          error: "End date must be after start date",
        });
      }

      // Check if date range changed
      if (
        (updateData.startDate &&
          startDate.getTime() !== existingRoster.startDate.getTime()) ||
        (updateData.endDate &&
          endDate.getTime() !== existingRoster.endDate.getTime())
      ) {
        checklistUpdatesNeeded.dateRange = true;
        checklistUpdatesNeeded.regenerateChecklist = true;
      }

      if (updateData.startDate) update.startDate = startDate;
      if (updateData.endDate) update.endDate = endDate;
    }

    // Handle weekly schedule updates
    if (updateData.weeklySchedule) {
      update.weeklySchedule = {};
      const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];

      for (const day of days) {
        if (updateData.weeklySchedule[day] !== undefined) {
          // Ensure each day is an array of time slots
          if (Array.isArray(updateData.weeklySchedule[day])) {
            update.weeklySchedule[day] = updateData.weeklySchedule[day].map(
              (slot) => {
                // Validate status
                if (
                  slot.status &&
                  !["ON", "OFF", "AL", "CL", "ML/PL", "PH", "UI"].includes(
                    slot.status,
                  )
                ) {
                  throw new Error(`Invalid status "${slot.status}" for ${day}`);
                }
                return {
                  startTime: slot.startTime || "",
                  endTime: slot.endTime || "",
                  status: slot.status || "ON",
                };
              },
            );
          } else {
            // Handle single time slot object (backward compatibility)
            const slot = updateData.weeklySchedule[day];
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
            update.weeklySchedule[day] = [
              {
                startTime: slot.startTime || "",
                endTime: slot.endTime || "",
                status: slot.status || "ON",
              },
            ];
          }
        } else {
          // Keep existing schedule for days not updated
          update.weeklySchedule[day] = existingRoster.weeklySchedule[day] || [
            { startTime: "", endTime: "", status: "ON" },
          ];
        }
      }
    }

    // Handle exceptions updates
    if (updateData.exceptions) {
      // Validate exceptions
      for (const exception of updateData.exceptions) {
        if (!exception.date || !exception.status) {
          return reply.status(400).send({
            success: false,
            error: "Each exception must have a date and status",
          });
        }
        if (
          !["ON", "OFF", "AL", "CL", "ML/PL", "PH", "UI"].includes(
            exception.status,
          )
        ) {
          return reply.status(400).send({
            success: false,
            error: `Invalid exception status "${exception.status}"`,
          });
        }
      }

      // Replace exceptions array or merge with existing
      if (updateData.replaceExceptions) {
        update.exceptions = updateData.exceptions.map((ex) => ({
          date: new Date(ex.date),
          startTime: ex.startTime || "",
          endTime: ex.endTime || "",
          status: ex.status,
          reason: ex.reason || "",
        }));
      } else {
        // For adding new exceptions while keeping existing ones that don't conflict
        const existingExceptions = existingRoster.exceptions || [];

        // Filter out existing exceptions for the same dates
        const exceptionsToKeep = existingExceptions.filter(
          (ex) =>
            !updateData.exceptions.some(
              (newEx) =>
                new Date(newEx.date).toISOString().split("T")[0] ===
                ex.date.toISOString().split("T")[0],
            ),
        );

        // Format new exceptions
        const newExceptions = updateData.exceptions.map((ex) => ({
          date: new Date(ex.date),
          startTime: ex.startTime || "",
          endTime: ex.endTime || "",
          status: ex.status,
          reason: ex.reason || "",
        }));

        update.exceptions = [...exceptionsToKeep, ...newExceptions];
      }
    }

    // Handle metadata updates
    if (updateData.metadata) {
      update.metadata = {
        ...existingRoster.metadata,
        ...updateData.metadata,
      };

      // Handle period updates within metadata
      if (updateData.metadata.period) {
        update.metadata.period = {
          ...(existingRoster.metadata?.period || {}),
          ...updateData.metadata.period,
        };

        if (updateData.metadata.period.startDate) {
          update.metadata.period.startDate = new Date(
            updateData.metadata.period.startDate,
          );
        }

        if (updateData.metadata.period.endDate) {
          update.metadata.period.endDate = new Date(
            updateData.metadata.period.endDate,
          );
        }
      }
    }

    // Handle checklist update options
    const checklistOptions = updateData.checklistOptions || {};

    // Update the roster
    const updatedRoster = await dutyRosterModel.findByIdAndUpdate(
      rosterId,
      { $set: update },
      { new: true, runValidators: true },
    );

    // Handle checklist updates based on what changed
    let checklistUpdateResult = null;
    try {
      if (
        checklistUpdatesNeeded.regenerateChecklist &&
        checklistOptions.regenerateChecklist
      ) {
        // Complete regeneration of checklist
        checklistUpdateResult = await regenerateChecklist(
          facilityId,
          rosterId,
          updatedRoster,
          checklistOptions,
          dutyRosterChecklistModel,
        );
      } else if (
        Object.values(checklistUpdatesNeeded).some((needed) => needed)
      ) {
        // Partial updates to existing checklist
        checklistUpdateResult = await updateExistingChecklist(
          facilityId,
          rosterId,
          updatedRoster,
          checklistUpdatesNeeded,
          dutyRosterChecklistModel,
        );
      }
    } catch (checklistError) {
      console.error("Error updating checklist:", checklistError);
      // Don't fail the entire operation, but log the error
      checklistUpdateResult = {
        success: false,
        error: checklistError.message,
      };
    }

    // Populate staff details for the response
    const staffUser = await payservedb.User.findById(updatedRoster.staffId);
    const responseData = {
      ...updatedRoster.toObject(),
      staffDetails: staffUser
        ? {
            _id: staffUser._id,
            fullName: staffUser.fullName,
            email: staffUser.email,
            phoneNumber: staffUser.phoneNumber,
            role: staffUser.role,
          }
        : null,
      checklistUpdate: checklistUpdateResult,
    };

    return reply.status(200).send({
      success: true,
      message: "Duty Roster updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error updating duty roster:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Helper function to regenerate checklist completely
const regenerateChecklist = async (
  facilityId,
  dutyRosterId,
  updatedRoster,
  options,
  dutyRosterChecklistModel,
) => {
  try {
    // Delete existing checklist
    const deleteResult = await dutyRosterChecklistModel.deleteMany({
      dutyRosterId: dutyRosterId,
    });

    // Get child workplans for the new master workplan
    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      payservedb.ChildWorkplan.schema,
      facilityId,
    );

    const childWorkplans = await childWorkplanModel.find({
      parent: updatedRoster.masterWorkplanId,
    });

    if (childWorkplans.length === 0) {
      return {
        success: false,
        message: "No child workplans found for the updated master workplan",
      };
    }

    // Generate new dates based on updated date range and frequency
    let scheduleDates = [];
    if (options.customDates && Array.isArray(options.customDates)) {
      scheduleDates = options.customDates.map((date) => new Date(date));
    } else {
      scheduleDates = dutyRosterChecklistModel.schema.statics.generateDateRange(
        updatedRoster.startDate,
        updatedRoster.endDate,
        options.taskFrequency || "daily",
      );
    }

    // Create new tasks
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

    // Create new checklist
    const newChecklist = await dutyRosterChecklistModel.create({
      dutyRosterId: dutyRosterId,
      facilityId: facilityId,
      staffId: updatedRoster.staffId,
      masterWorkplanId: updatedRoster.masterWorkplanId,
      tasks,
      period: {
        startDate: updatedRoster.startDate,
        endDate: updatedRoster.endDate,
      },
      status: "active",
    });

    return {
      success: true,
      message: "Checklist regenerated successfully",
      deletedChecklistsCount: deleteResult.deletedCount,
      newChecklistId: newChecklist._id,
      tasksCount: tasks.length,
      scheduledDatesCount: scheduleDates.length,
    };
  } catch (error) {
    throw new Error(`Failed to regenerate checklist: ${error.message}`);
  }
};

// Helper function to update existing checklist
const updateExistingChecklist = async (
  facilityId,
  dutyRosterId,
  updatedRoster,
  changesNeeded,
  dutyRosterChecklistModel,
) => {
  try {
    const existingChecklist = await dutyRosterChecklistModel.findOne({
      dutyRosterId: dutyRosterId,
    });

    if (!existingChecklist) {
      return {
        success: false,
        message: "No existing checklist found to update",
      };
    }

    const updates = {};

    // Update staff ID if changed
    if (changesNeeded.staffId) {
      updates.staffId = updatedRoster.staffId;
    }

    // Update master workplan ID if changed
    if (changesNeeded.masterWorkplan) {
      updates.masterWorkplanId = updatedRoster.masterWorkplanId;
    }

    // Update date range if changed
    if (changesNeeded.dateRange) {
      updates["period.startDate"] = updatedRoster.startDate;
      updates["period.endDate"] = updatedRoster.endDate;
    }

    // Apply updates
    const updatedChecklist = await dutyRosterChecklistModel.findByIdAndUpdate(
      existingChecklist._id,
      { $set: updates },
      { new: true },
    );

    return {
      success: true,
      message: "Checklist updated successfully",
      updatedFields: Object.keys(updates),
      checklistId: updatedChecklist._id,
    };
  } catch (error) {
    throw new Error(`Failed to update existing checklist: ${error.message}`);
  }
};

module.exports = editDutyRoster;
