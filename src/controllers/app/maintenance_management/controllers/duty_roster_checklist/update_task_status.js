const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const updateTaskStatus = async (request, reply) => {
    try {
        const { facilityId, checklistId, taskId, dateId } = request.params;
        const { status, notes, startTime, endTime, completedBy } = request.body;

        // Audit the task status update attempt
        await audit_trail(request, {
            activity: "Update Task Status",
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                task_id: taskId,
                date_id: dateId,
                new_status: status,
                has_notes: !!notes,
                has_start_time: !!startTime,
                has_end_time: !!endTime,
                has_completed_by: !!completedBy,
            },
        });

        // Validate ObjectId formats
        const idValidation = [
            { id: checklistId, name: "checklist ID" },
            { id: taskId, name: "task ID" },
            { id: dateId, name: "date ID" },
        ];

        for (const { id, name } of idValidation) {
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                // Audit validation error
                await audit_trail(request, {
                    activity: "Update Task Status",
                    response_status: "error",
                    custom_data: {
                        facility_id: facilityId,
                        checklist_id: checklistId,
                        task_id: taskId,
                        date_id: dateId,
                        error_type: "ValidationError",
                        error_message: `Invalid ${name} format`,
                        invalid_id: id,
                        invalid_field: name,
                    },
                });

                return reply.code(400).send({
                    success: false,
                    error: `Invalid ${name} format`,
                });
            }
        }

        // Validate status
        const validStatuses = [
            "pending",
            "completed",
            "missed",
            "cancelled",
            "in-progress",
        ];
        if (!status || !validStatuses.includes(status)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Update Task Status",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    date_id: dateId,
                    error_type: "ValidationError",
                    error_message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
                    invalid_status: status,
                    valid_statuses: validStatuses,
                },
            });

            return reply.code(400).send({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
            });
        }

        // Validate completedBy if status is completed
        if (
            status === "completed" &&
            completedBy &&
            !completedBy.match(/^[0-9a-fA-F]{24}$/)
        ) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Update Task Status",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    date_id: dateId,
                    error_type: "ValidationError",
                    error_message: "Invalid completedBy user ID format",
                    invalid_completed_by: completedBy,
                    status: status,
                },
            });

            return reply.code(400).send({
                success: false,
                error: "Invalid completedBy user ID format",
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
                activity: "Update Task Status",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    date_id: dateId,
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
                activity: "Update Task Status",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    date_id: dateId,
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

        // Find the task and scheduled date
        const task = checklist.tasks.id(taskId);
        if (!task) {
            // Audit task not found
            await audit_trail(request, {
                activity: "Update Task Status",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    date_id: dateId,
                    error: "Task not found in checklist",
                    checklist_tasks_count: checklist.tasks.length,
                },
            });

            return reply.code(404).send({
                success: false,
                error: "Task not found in checklist",
            });
        }

        const scheduledDate = task.scheduledDates.id(dateId);
        if (!scheduledDate) {
            // Audit scheduled date not found
            await audit_trail(request, {
                activity: "Update Task Status",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    date_id: dateId,
                    error: "Scheduled date not found for task",
                    task_scheduled_dates_count: task.scheduledDates.length,
                },
            });

            return reply.code(404).send({
                success: false,
                error: "Scheduled date not found for task",
            });
        }

        // Store previous data for audit
        const previousStatus = scheduledDate.status;
        const previousData = {
            status: scheduledDate.status,
            notes: scheduledDate.notes,
            startTime: scheduledDate.startTime,
            endTime: scheduledDate.endTime,
            completedAt: scheduledDate.completedAt,
            completedBy: scheduledDate.completedBy,
            actualDuration: scheduledDate.actualDuration,
        };

        const previousSummary = {
            totalTasks: checklist.summary?.totalTasks || 0,
            completedTasks: checklist.summary?.completedTasks || 0,
            pendingTasks: checklist.summary?.pendingTasks || 0,
            missedTasks: checklist.summary?.missedTasks || 0,
            completionPercentage: checklist.summary?.completionPercentage || 0,
        };

        // Update the scheduled date
        scheduledDate.status = status;
        if (notes !== undefined) scheduledDate.notes = notes;
        if (startTime !== undefined) scheduledDate.startTime = startTime;
        if (endTime !== undefined) scheduledDate.endTime = endTime;

        let durationCalculated = false;
        let calculatedDuration = null;

        // Handle completion-specific updates
        if (status === "completed") {
            scheduledDate.completedAt = new Date();
            if (completedBy) scheduledDate.completedBy = completedBy;

            // Calculate actual duration if start and end times are provided
            if (startTime && endTime) {
                try {
                    const start = new Date(`2000-01-01 ${startTime}`);
                    const end = new Date(`2000-01-01 ${endTime}`);
                    if (end > start) {
                        calculatedDuration = Math.round((end - start) / (1000 * 60)); // in minutes
                        scheduledDate.actualDuration = calculatedDuration;
                        durationCalculated = true;
                    }
                } catch (timeError) {
                    console.warn("Could not calculate duration:", timeError.message);

                    // Audit duration calculation warning
                    await audit_trail(request, {
                        activity: "Update Task Status",
                        response_status: "warning",
                        custom_data: {
                            facility_id: facilityId,
                            checklist_id: checklistId,
                            task_id: taskId,
                            date_id: dateId,
                            warning: "Could not calculate actual duration",
                            error_message: timeError.message,
                            start_time: startTime,
                            end_time: endTime,
                        },
                    });
                }
            }
        } else {
            // Clear completion data if status changed from completed
            if (previousStatus === "completed") {
                scheduledDate.completedAt = undefined;
                scheduledDate.completedBy = undefined;
                scheduledDate.actualDuration = undefined;
            }
        }

        // Save the checklist (this will trigger the pre-save hook to update summary)
        await checklist.save();

        // Get updated task for response
        const updatedTask = checklist.tasks.id(taskId);
        const updatedScheduledDate = updatedTask.scheduledDates.id(dateId);

        // Audit successful task status update
        await audit_trail(request, {
            activity: "Update Task Status - Success",
            response_status: "success",
            previous_data: {
                scheduled_date: previousData,
                summary: previousSummary,
            },
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                task_id: taskId,
                date_id: dateId,
                child_workplan_id: task.childWorkplanId,
                status_change: {
                    from: previousStatus,
                    to: status,
                },
                updated_fields: {
                    status: status !== previousStatus,
                    notes: notes !== undefined,
                    start_time: startTime !== undefined,
                    end_time: endTime !== undefined,
                    completed_by: completedBy !== undefined,
                },
                completion_details: status === "completed" ? {
                    completed_at: updatedScheduledDate.completedAt,
                    completed_by: updatedScheduledDate.completedBy,
                    actual_duration: updatedScheduledDate.actualDuration,
                    duration_calculated: durationCalculated,
                    calculated_duration: calculatedDuration,
                } : null,
                cleared_completion_data: previousStatus === "completed" && status !== "completed",
                previous_summary: previousSummary,
                updated_summary: checklist.summary,
                summary_changes: {
                    completed_tasks_change: checklist.summary.completedTasks - previousSummary.completedTasks,
                    pending_tasks_change: checklist.summary.pendingTasks - previousSummary.pendingTasks,
                    missed_tasks_change: checklist.summary.missedTasks - previousSummary.missedTasks,
                    completion_percentage_change: checklist.summary.completionPercentage - previousSummary.completionPercentage,
                },
            },
        });

        return reply.code(200).send({
            success: true,
            message: "Task status updated successfully",
            data: {
                checklistId: checklist._id,
                taskId: updatedTask._id,
                dateId: updatedScheduledDate._id,
                updatedScheduledDate: {
                    date: updatedScheduledDate.date,
                    status: updatedScheduledDate.status,
                    startTime: updatedScheduledDate.startTime,
                    endTime: updatedScheduledDate.endTime,
                    notes: updatedScheduledDate.notes,
                    completedAt: updatedScheduledDate.completedAt,
                    completedBy: updatedScheduledDate.completedBy,
                    actualDuration: updatedScheduledDate.actualDuration,
                },
                previousStatus,
                updatedSummary: checklist.summary,
            },
        });
    } catch (error) {
        console.error("Error updating task status:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Update Task Status - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                checklist_id: request.params.checklistId,
                task_id: request.params.taskId,
                date_id: request.params.dateId,
                error_type: error.name,
                error_message: error.message,
                error_stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                request_body: request.body,
            },
        });

        return reply.code(500).send({
            success: false,
            error: error.message,
        });
    }
};

module.exports = updateTaskStatus;