const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const removeTaskFromChecklist = async (request, reply) => {
    try {
        const { facilityId, checklistId, taskId } = request.params;
        const { confirmDeletion = false } = request.body;

        // Audit the task removal attempt
        await audit_trail(request, {
            activity: "Remove Task From Checklist",
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                task_id: taskId,
                confirm_deletion: confirmDeletion,
            },
        });

        // Validate ObjectId formats
        const idValidation = [
            { id: checklistId, name: "checklist ID" },
            { id: taskId, name: "task ID" },
        ];

        for (const { id, name } of idValidation) {
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                // Audit validation error
                await audit_trail(request, {
                    activity: "Remove Task From Checklist",
                    response_status: "error",
                    custom_data: {
                        facility_id: facilityId,
                        checklist_id: checklistId,
                        task_id: taskId,
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

        const dutyRosterChecklistModel = await getModel(
            "DutyRosterChecklist",
            payservedb.DutyRosterChecklist.schema,
            facilityId,
        );

        const checklist = await dutyRosterChecklistModel.findById(checklistId);

        if (!checklist) {
            // Audit checklist not found
            await audit_trail(request, {
                activity: "Remove Task From Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
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
                activity: "Remove Task From Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
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

        // Find the task
        const taskToRemove = checklist.tasks.id(taskId);
        if (!taskToRemove) {
            // Audit task not found
            await audit_trail(request, {
                activity: "Remove Task From Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    error: "Task not found in checklist",
                    checklist_tasks_count: checklist.tasks.length,
                },
            });

            return reply.code(404).send({
                success: false,
                error: "Task not found in checklist",
            });
        }

        // Check if task has completed activities
        const hasCompletedActivities = taskToRemove.scheduledDates.some(
            (scheduledDate) => scheduledDate.status === "completed",
        );

        const taskDetails = {
            _id: taskToRemove._id,
            childWorkplanId: taskToRemove.childWorkplanId,
            totalScheduledDates: taskToRemove.scheduledDates.length,
            completedDates: taskToRemove.scheduledDates.filter(
                (d) => d.status === "completed",
            ).length,
            pendingDates: taskToRemove.scheduledDates.filter(
                (d) => d.status === "pending",
            ).length,
            missedDates: taskToRemove.scheduledDates.filter(
                (d) => d.status === "missed",
            ).length,
            inProgressDates: taskToRemove.scheduledDates.filter(
                (d) => d.status === "in-progress",
            ).length,
        };

        // Require confirmation if task has completed activities
        if (hasCompletedActivities && !confirmDeletion) {
            // Audit confirmation required
            await audit_trail(request, {
                activity: "Remove Task From Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    checklist_id: checklistId,
                    task_id: taskId,
                    error_type: "ConfirmationRequired",
                    error_message: "Task has completed activities. Confirmation required to proceed.",
                    has_completed_activities: true,
                    task_details: taskDetails,
                    warning: "Removing this task will permanently delete completion history",
                },
            });

            return reply.code(400).send({
                success: false,
                error:
                    "Task has completed activities. Set confirmDeletion to true to proceed.",
                warning:
                    "Removing this task will permanently delete completion history",
                taskDetails: taskDetails,
            });
        }

        // Store previous summary for audit
        const previousSummary = {
            totalTasks: checklist.summary?.totalTasks || 0,
            completedTasks: checklist.summary?.completedTasks || 0,
            pendingTasks: checklist.summary?.pendingTasks || 0,
            missedTasks: checklist.summary?.missedTasks || 0,
            completionPercentage: checklist.summary?.completionPercentage || 0,
        };

        // Store task details for response before removal
        const removedTaskDetails = {
            _id: taskToRemove._id,
            childWorkplanId: taskToRemove.childWorkplanId,
            priority: taskToRemove.priority,
            estimatedDuration: taskToRemove.estimatedDuration,
            isRecurring: taskToRemove.isRecurring,
            recurringPattern: taskToRemove.recurringPattern,
            scheduledDatesCount: taskToRemove.scheduledDates.length,
            completedDatesCount: taskToRemove.scheduledDates.filter(
                (d) => d.status === "completed",
            ).length,
            pendingDatesCount: taskToRemove.scheduledDates.filter(
                (d) => d.status === "pending",
            ).length,
            missedDatesCount: taskToRemove.scheduledDates.filter(
                (d) => d.status === "missed",
            ).length,
        };

        // Remove the task
        checklist.tasks.id(taskId).remove();
        await checklist.save(); // This will trigger summary recalculation

        // Audit successful task removal
        await audit_trail(request, {
            activity: "Remove Task From Checklist - Success",
            response_status: "success",
            previous_data: {
                tasks_count: previousSummary.totalTasks,
                summary: previousSummary,
            },
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                removed_task_id: taskId,
                removed_task_details: removedTaskDetails,
                confirmation_provided: confirmDeletion,
                had_completed_activities: hasCompletedActivities,
                previous_summary: previousSummary,
                updated_summary: checklist.summary,
                remaining_tasks_count: checklist.tasks.length,
                tasks_count_change: checklist.tasks.length - previousSummary.totalTasks,
                completion_percentage_change:
                    checklist.summary.completionPercentage - previousSummary.completionPercentage,
            },
        });

        return reply.code(200).send({
            success: true,
            message: "Task removed from checklist successfully",
            data: {
                checklistId: checklist._id,
                removedTask: removedTaskDetails,
                updatedSummary: checklist.summary,
                remainingTasksCount: checklist.tasks.length,
            },
        });
    } catch (error) {
        console.error("Error removing task from checklist:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Remove Task From Checklist - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                checklist_id: request.params.checklistId,
                task_id: request.params.taskId,
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

module.exports = removeTaskFromChecklist;