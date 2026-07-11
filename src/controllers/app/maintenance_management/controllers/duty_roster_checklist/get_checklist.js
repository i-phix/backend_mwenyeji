const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const getDutyRosterChecklist = async (request, reply) => {
    try {
        const { facilityId, checklistId } = request.params;
        const {
            includeTaskDetails = "true",
            includeChildWorkplanDetails = "false",
        } = request.query;

        // Audit the checklist retrieval attempt
        await audit_trail(request, {
            activity: "Get Duty Roster Checklist",
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                query_options: {
                    include_task_details: includeTaskDetails,
                    include_child_workplan_details: includeChildWorkplanDetails,
                },
            },
        });

        // Validate ObjectId format
        if (!checklistId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Get Duty Roster Checklist",
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

        const dutyRosterChecklistModel = await getModel(
            "DutyRosterChecklist",
            payservedb.DutyRosterChecklist.schema,
            facilityId,
        );

        const checklist = await dutyRosterChecklistModel
            .findById(checklistId)
            .lean();

        if (!checklist) {
            // Audit checklist not found
            await audit_trail(request, {
                activity: "Get Duty Roster Checklist",
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
                activity: "Get Duty Roster Checklist",
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

        // Enhanced checklist data
        let enhancedChecklist = { ...checklist };
        let childWorkplansLoaded = false;
        let childWorkplansCount = 0;

        // Include child workplan details if requested
        if (includeChildWorkplanDetails === "true" && checklist.tasks) {
            try {
                const childWorkplanModel = await getModel(
                    "ChildWorkplan",
                    payservedb.ChildWorkplan.schema,
                    facilityId,
                );

                const childWorkplanIds = [
                    ...new Set(checklist.tasks.map((task) => task.childWorkplanId)),
                ];
                const childWorkplans = await childWorkplanModel
                    .find({
                        _id: { $in: childWorkplanIds },
                    })
                    .lean();

                childWorkplansCount = childWorkplans.length;
                childWorkplansLoaded = true;

                const childWorkplanMap = childWorkplans.reduce((map, child) => {
                    map[child._id.toString()] = child;
                    return map;
                }, {});

                enhancedChecklist.tasks = checklist.tasks.map((task) => ({
                    ...task,
                    childWorkplanDetails:
                        childWorkplanMap[task.childWorkplanId.toString()] || null,
                }));
            } catch (error) {
                console.error("Error fetching child workplan details:", error);

                // Audit child workplan loading error
                await audit_trail(request, {
                    activity: "Get Duty Roster Checklist",
                    response_status: "warning",
                    custom_data: {
                        facility_id: facilityId,
                        checklist_id: checklistId,
                        error_type: "ChildWorkplanLoadError",
                        error_message: error.message,
                        warning: "Failed to load child workplan details, continuing without them",
                    },
                });
            }
        }

        // Add computed fields
        enhancedChecklist.computed = {
            isActive: checklist.status === "active",
            daysRemaining: checklist.period
                ? Math.ceil(
                    (new Date(checklist.period.endDate) - new Date()) /
                    (1000 * 60 * 60 * 24),
                )
                : null,
            totalDuration: checklist.period
                ? Math.ceil(
                    (new Date(checklist.period.endDate) -
                        new Date(checklist.period.startDate)) /
                    (1000 * 60 * 60 * 24),
                )
                : null,
            averageCompletionPerDay:
                checklist.period && checklist.summary
                    ? (
                        checklist.summary.completedTasks /
                        Math.max(
                            1,
                            Math.ceil(
                                (new Date() - new Date(checklist.period.startDate)) /
                                (1000 * 60 * 60 * 24),
                            ),
                        )
                    ).toFixed(2)
                    : 0,
        };

        // Filter task details based on query parameter
        const tasksIncluded = includeTaskDetails === "true";
        if (!tasksIncluded) {
            delete enhancedChecklist.tasks;
        }

        // Audit successful checklist retrieval
        await audit_trail(request, {
            activity: "Get Duty Roster Checklist - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                checklist_status: checklist.status,
                staff_id: checklist.staffId,
                master_workplan_id: checklist.masterWorkplanId,
                duty_roster_id: checklist.dutyRosterId,
                total_tasks: checklist.tasks?.length || 0,
                summary: checklist.summary,
                period: checklist.period,
                computed_metrics: enhancedChecklist.computed,
                data_included: {
                    task_details: tasksIncluded,
                    child_workplan_details: childWorkplansLoaded,
                    child_workplans_count: childWorkplansCount,
                },
            },
        });

        return reply.code(200).send({
            success: true,
            message: "Duty roster checklist retrieved successfully",
            data: {
                checklist: enhancedChecklist,
            },
        });
    } catch (error) {
        console.error("Error getting duty roster checklist:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Duty Roster Checklist - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                checklist_id: request.params.checklistId,
                error_type: error.name,
                error_message: error.message,
                error_stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                query_options: request.query,
            },
        });

        return reply.code(500).send({
            success: false,
            error: error.message,
        });
    }
};

module.exports = getDutyRosterChecklist;