
const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const addTaskToChecklist = async (request, reply) => {
    try {
        const { facilityId, checklistId } = request.params;
        const {
            childWorkplanId,
            scheduledDates,
            priority = "medium",
            estimatedDuration,
            isRecurring = false,
            recurringPattern,
            generateDatesFromRange = false,
            dateRange,
        } = request.body;

        // Audit the task addition attempt
        await audit_trail(request, {
            activity: "Add Task to Checklist",
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                child_workplan_id: childWorkplanId,
                priority,
                is_recurring: isRecurring,
                generate_dates_from_range: generateDatesFromRange,
                scheduled_dates_count: scheduledDates ? scheduledDates.length : 0,
            },
        });

        // Validate ObjectId formats
        if (!checklistId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    error_type: "ValidationError",
                    error_message: "Invalid checklist ID format",
                    invalid_checklist_id: checklistId,
                },
            });

            return reply.code(400).send({
                success: false,
                error: "Invalid checklist ID format",
            });
        }

        if (!childWorkplanId || !childWorkplanId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    error_type: "ValidationError",
                    error_message: "Valid childWorkplanId is required",
                    invalid_child_workplan_id: childWorkplanId,
                },
            });

            return reply.code(400).send({
                success: false,
                error: "Valid childWorkplanId is required",
            });
        }

        // Validate priority
        const validPriorities = ["low", "medium", "high", "critical"];
        if (!validPriorities.includes(priority)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    error_type: "ValidationError",
                    error_message: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
                    invalid_priority: priority,
                    valid_priorities: validPriorities,
                },
            });

            return reply.code(400).send({
                success: false,
                error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
            });
        }

        // Validate recurring pattern if isRecurring is true
        if (
            isRecurring &&
            recurringPattern &&
            !["daily", "weekly", "monthly", "custom"].includes(recurringPattern)
        ) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    error_type: "ValidationError",
                    error_message: "Invalid recurringPattern. Must be one of: daily, weekly, monthly, custom",
                    invalid_recurring_pattern: recurringPattern,
                },
            });

            return reply.code(400).send({
                success: false,
                error:
                    "Invalid recurringPattern. Must be one of: daily, weekly, monthly, custom",
            });
        }

        const dutyRosterChecklistModel = await getModel(
            "DutyRosterChecklist",
            payservedb.DutyRosterChecklist.schema,
            facilityId,
        );

        const checklist = await dutyRosterChecklistModel.findById(checklistId);

        if (!checklist) {
            // Audit checklist not found
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    error: "Duty roster checklist not found",
                },
            });

            return reply.code(404).send({
                success: false,
                error: "Duty roster checklist not found",
            });
        }

        // Verify checklist belongs to the facility
        if (checklist.facilityId.toString() !== facilityId) {
            // Audit unauthorized access
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    error_type: "UnauthorizedAccess",
                    checklist_facility_id: checklist.facilityId.toString(),
                    requested_facility_id: facilityId,
                },
            });

            return reply.code(403).send({
                success: false,
                error: "Unauthorized: Checklist does not belong to this facility",
            });
        }

        // Verify child workplan exists and belongs to the same master workplan
        const childWorkplanModel = await getModel(
            "ChildWorkplan",
            payservedb.ChildWorkplan.schema,
            facilityId,
        );

        const childWorkplan = await childWorkplanModel.findById(childWorkplanId);
        if (!childWorkplan) {
            // Audit child workplan not found
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    child_workplan_id: childWorkplanId,
                    error: "Child workplan not found",
                },
            });

            return reply.code(404).send({
                success: false,
                error: "Child workplan not found",
            });
        }

        if (
            childWorkplan.parent.toString() !== checklist.masterWorkplanId.toString()
        ) {
            // Audit workplan mismatch
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    child_workplan_id: childWorkplanId,
                    error_type: "WorkplanMismatch",
                    child_workplan_parent: childWorkplan.parent.toString(),
                    checklist_master_workplan: checklist.masterWorkplanId.toString(),
                },
            });

            return reply.code(400).send({
                success: false,
                error:
                    "Child workplan does not belong to the same master workplan as this checklist",
            });
        }

        // Check if task already exists for this child workplan
        const existingTask = checklist.tasks.find(
            (task) => task.childWorkplanId.toString() === childWorkplanId,
        );

        if (existingTask) {
            // Audit duplicate task
            await audit_trail(request, {
                activity: "Add Task to Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    child_workplan_id: childWorkplanId,
                    error_type: "DuplicateTask",
                    existing_task_id: existingTask._id,
                },
            });

            return reply.code(409).send({
                success: false,
                error: "Task for this child workplan already exists in the checklist",
                existingTaskId: existingTask._id,
            });
        }

        // Process scheduled dates
        let processedScheduledDates = [];

        if (generateDatesFromRange && dateRange) {
            // Generate dates from range
            const { startDate, endDate, frequency = "daily" } = dateRange;

            if (!startDate || !endDate) {
                // Audit date range validation error
                await audit_trail(request, {
                    activity: "Add Task to Checklist",
                    response_status: "error",
                    custom_data: {
                        facility_id: facilityId,
                        checklist_id: checklistId,
                        error_type: "ValidationError",
                        error_message: "startDate and endDate are required when generateDatesFromRange is true",
                        provided_date_range: dateRange,
                    },
                });

                return reply.code(400).send({
                    success: false,
                    error:
                        "startDate and endDate are required when generateDatesFromRange is true",
                });
            }

            const generatedDates =
                dutyRosterChecklistModel.schema.statics.generateDateRange(
                    new Date(startDate),
                    new Date(endDate),
                    frequency,
                );

            processedScheduledDates = generatedDates.map((date) => ({
                date: new Date(date),
                status: "pending",
                startTime: "",
                endTime: "",
                notes: "",
            }));
        } else {
            // Use provided scheduled dates
            if (
                !scheduledDates ||
                !Array.isArray(scheduledDates) ||
                scheduledDates.length === 0
            ) {
                // Audit scheduled dates validation error
                await audit_trail(request, {
                    activity: "Add Task to Checklist",
                    response_status: "error",
                    custom_data: {
                        facility_id: facilityId,
                        checklist_id: checklistId,
                        error_type: "ValidationError",
                        error_message: "scheduledDates array is required when generateDatesFromRange is false",
                        provided_scheduled_dates: scheduledDates,
                    },
                });

                return reply.code(400).send({
                    success: false,
                    error:
                        "scheduledDates array is required when generateDatesFromRange is false",
                });
            }

            // Validate and process scheduled dates
            processedScheduledDates = scheduledDates.map((dateInfo) => {
                if (!dateInfo.date) {
                    throw new Error("Each scheduled date must have a date field");
                }

                const validStatuses = [
                    "pending",
                    "completed",
                    "missed",
                    "cancelled",
                    "in-progress",
                ];
                const dateStatus = dateInfo.status || "pending";

                if (!validStatuses.includes(dateStatus)) {
                    throw new Error(`Invalid status "${dateStatus}" for scheduled date`);
                }

                return {
                    date: new Date(dateInfo.date),
                    status: dateStatus,
                    startTime: dateInfo.startTime || "",
                    endTime: dateInfo.endTime || "",
                    notes: dateInfo.notes || "",
                    completedAt: dateInfo.completedAt
                        ? new Date(dateInfo.completedAt)
                        : undefined,
                    completedBy: dateInfo.completedBy || undefined,
                    actualDuration: dateInfo.actualDuration || undefined,
                };
            });
        }

        // Store previous summary for audit
        const previousSummary = {
            totalTasks: checklist.summary?.totalTasks || 0,
            completedTasks: checklist.summary?.completedTasks || 0,
            pendingTasks: checklist.summary?.pendingTasks || 0,
            missedTasks: checklist.summary?.missedTasks || 0,
        };

        // Create new task
        const newTask = {
            childWorkplanId,
            scheduledDates: processedScheduledDates,
            priority,
            estimatedDuration: estimatedDuration || undefined,
            isRecurring,
            recurringPattern: isRecurring ? recurringPattern || "daily" : undefined,
        };

        // Add task to checklist
        checklist.tasks.push(newTask);
        await checklist.save(); // This will trigger summary recalculation

        // Get the newly added task
        const addedTask = checklist.tasks[checklist.tasks.length - 1];

        // Audit successful task addition
        await audit_trail(request, {
            activity: "Add Task to Checklist - Success",
            response_status: "success",
            previous_data: {
                tasks_count: previousSummary.totalTasks,
                summary: previousSummary,
            },
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                added_task_id: addedTask._id,
                child_workplan_id: childWorkplanId,
                priority,
                is_recurring: isRecurring,
                recurring_pattern: recurringPattern,
                scheduled_dates_count: processedScheduledDates.length,
                estimated_duration: estimatedDuration,
                new_summary: checklist.summary,
                tasks_count_change: checklist.tasks.length - previousSummary.totalTasks,
            },
        });

        return reply.code(201).send({
            success: true,
            message: "Task added to checklist successfully",
            data: {
                checklistId: checklist._id,
                addedTask: {
                    _id: addedTask._id,
                    childWorkplanId: addedTask.childWorkplanId,
                    scheduledDates: addedTask.scheduledDates,
                    priority: addedTask.priority,
                    estimatedDuration: addedTask.estimatedDuration,
                    isRecurring: addedTask.isRecurring,
                    recurringPattern: addedTask.recurringPattern,
                },
                updatedSummary: checklist.summary,
                scheduledDatesCount: processedScheduledDates.length,
            },
        });
    } catch (error) {
        console.error("Error adding task to checklist:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Add Task to Checklist - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                checklist_id: request.params.checklistId,
                error_type: error.name,
                error_message: error.message,
                attempted_data: request.body,
            },
        });

        return reply.code(500).send({
            success: false,
            error: error.message,
        });
    }
};

module.exports = addTaskToChecklist;