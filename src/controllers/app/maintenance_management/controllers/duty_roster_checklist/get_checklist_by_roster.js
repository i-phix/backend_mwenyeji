const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const getChecklistByDutyRoster = async (request, reply) => {
    try {
        const { facilityId, dutyRosterId } = request.params;
        const {
            includeTaskDetails = "true",
            includeChildWorkplanDetails = "false",
            includeTodaysTasks = "true",
            includeUpcomingTasks = "false",
        } = request.query;

        // Audit the checklist retrieval attempt
        await audit_trail(request, {
            activity: "Get Checklist By Duty Roster",
            custom_data: {
                facility_id: facilityId,
                duty_roster_id: dutyRosterId,
                query_options: {
                    include_task_details: includeTaskDetails,
                    include_child_workplan_details: includeChildWorkplanDetails,
                    include_todays_tasks: includeTodaysTasks,
                    include_upcoming_tasks: includeUpcomingTasks,
                },
            },
        });

        console.log(
            `Fetching checklist for duty roster: ${dutyRosterId} in facility: ${facilityId}`,
        );

        // Validate ObjectId format
        if (!dutyRosterId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Get Checklist By Duty Roster",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    error_type: "ValidationError",
                    error_message: "Invalid duty roster ID format",
                    invalid_duty_roster_id: dutyRosterId,
                },
            });

            return reply.code(400).send({
                success: false,
                error: "Invalid duty roster ID format",
            });
        }

        const dutyRosterChecklistModel = await getModel(
            "DutyRosterChecklist",
            payservedb.DutyRosterChecklist.schema,
            facilityId,
        );

        console.log("Looking for checklist with dutyRosterId:", dutyRosterId);

        const checklist = await dutyRosterChecklistModel
            .findOne({
                dutyRosterId,
                facilityId,
            })
            .lean();

        if (!checklist) {
            console.log("No checklist found for duty roster:", dutyRosterId);

            // Audit checklist not found
            await audit_trail(request, {
                activity: "Get Checklist By Duty Roster",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    duty_roster_id: dutyRosterId,
                    error: "Duty roster checklist not found for this duty roster",
                    search_criteria: {
                        duty_roster_id: dutyRosterId,
                        facility_id: facilityId,
                    },
                },
            });

            return reply.code(404).send({
                success: false,
                error: "Duty roster checklist not found for this duty roster",
                debug: {
                    searchCriteria: {
                        dutyRosterId,
                        facilityId,
                    },
                },
            });
        }

        console.log("Found checklist:", checklist._id);

        // Enhanced checklist data
        let enhancedChecklist = { ...checklist };
        let childWorkplansLoaded = false;
        let childWorkplansCount = 0;

        // Include child workplan details if requested
        if (includeChildWorkplanDetails === "true" && checklist.tasks) {
            try {
                // FIXED: Use the correct model name
                const childWorkplanModel = await getModel(
                    "ChildWorkplan", // Model registration name
                    payservedb.MasterWorkplanChild.schema, // Correct schema reference
                    facilityId,
                );

                const childWorkplanIds = [
                    ...new Set(checklist.tasks.map((task) => task.childWorkplanId)),
                ];

                console.log("Fetching child workplans for IDs:", childWorkplanIds);

                const childWorkplans = await childWorkplanModel
                    .find({
                        _id: { $in: childWorkplanIds },
                    })
                    .lean();

                console.log("Found child workplans:", childWorkplans.length);
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
                    activity: "Get Checklist By Duty Roster",
                    response_status: "warning",
                    custom_data: {
                        facility_id: facilityId,
                        duty_roster_id: dutyRosterId,
                        checklist_id: checklist._id,
                        error_type: "ChildWorkplanLoadError",
                        error_message: error.message,
                        warning: "Failed to load child workplan details, continuing without them",
                    },
                });
            }
        }

        let todaysTasksCount = 0;
        let upcomingTasksCount = 0;

        // Include today's tasks if requested
        if (includeTodaysTasks === "true" && checklist.tasks) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const todaysTasks = [];
            checklist.tasks.forEach((task) => {
                task.scheduledDates.forEach((scheduledDate) => {
                    const taskDate = new Date(scheduledDate.date);
                    taskDate.setHours(0, 0, 0, 0);

                    if (taskDate.getTime() === today.getTime()) {
                        todaysTasks.push({
                            taskId: task._id,
                            dateId: scheduledDate._id,
                            childWorkplanId: task.childWorkplanId,
                            date: scheduledDate.date,
                            status: scheduledDate.status,
                            startTime: scheduledDate.startTime,
                            endTime: scheduledDate.endTime,
                            notes: scheduledDate.notes,
                            priority: task.priority,
                            estimatedDuration: task.estimatedDuration,
                            completedAt: scheduledDate.completedAt,
                            completedBy: scheduledDate.completedBy,
                            actualDuration: scheduledDate.actualDuration,
                            // Include child workplan details for today's tasks if available
                            childWorkplanDetails:
                                enhancedChecklist.tasks?.find(
                                    (t) => t._id.toString() === task._id.toString(),
                                )?.childWorkplanDetails || null,
                        });
                    }
                });
            });

            enhancedChecklist.todaysTasks = todaysTasks;
            todaysTasksCount = todaysTasks.length;
            console.log("Today's tasks:", todaysTasks.length);
        }

        // Include upcoming tasks if requested
        if (includeUpcomingTasks === "true" && checklist.tasks) {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            const upcomingTasks = [];
            checklist.tasks.forEach((task) => {
                task.scheduledDates.forEach((scheduledDate) => {
                    const taskDate = new Date(scheduledDate.date);

                    if (
                        taskDate > today &&
                        taskDate <= nextWeek &&
                        scheduledDate.status === "pending"
                    ) {
                        upcomingTasks.push({
                            taskId: task._id,
                            dateId: scheduledDate._id,
                            childWorkplanId: task.childWorkplanId,
                            date: scheduledDate.date,
                            status: scheduledDate.status,
                            startTime: scheduledDate.startTime,
                            endTime: scheduledDate.endTime,
                            priority: task.priority,
                            estimatedDuration: task.estimatedDuration,
                            daysUntilDue: Math.ceil(
                                (taskDate - new Date()) / (1000 * 60 * 60 * 24),
                            ),
                            // Include child workplan details for upcoming tasks if available
                            childWorkplanDetails:
                                enhancedChecklist.tasks?.find(
                                    (t) => t._id.toString() === task._id.toString(),
                                )?.childWorkplanDetails || null,
                        });
                    }
                });
            });

            // Sort by date
            upcomingTasks.sort((a, b) => new Date(a.date) - new Date(b.date));
            enhancedChecklist.upcomingTasks = upcomingTasks;
            upcomingTasksCount = upcomingTasks.length;
            console.log("Upcoming tasks:", upcomingTasks.length);
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
            isOverdue: checklist.period
                ? new Date() > new Date(checklist.period.endDate)
                : false,
            isUpcoming: checklist.period
                ? new Date() < new Date(checklist.period.startDate)
                : false,
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

        // Remove full task details if not requested
        const tasksIncluded = includeTaskDetails === "true";
        if (!tasksIncluded) {
            delete enhancedChecklist.tasks;
        }

        console.log("Returning enhanced checklist");

        // Audit successful checklist retrieval
        await audit_trail(request, {
            activity: "Get Checklist By Duty Roster - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                duty_roster_id: dutyRosterId,
                checklist_id: checklist._id,
                checklist_status: checklist.status,
                staff_id: checklist.staffId,
                master_workplan_id: checklist.masterWorkplanId,
                total_tasks: checklist.tasks?.length || 0,
                summary: checklist.summary,
                period: checklist.period,
                computed_metrics: enhancedChecklist.computed,
                data_included: {
                    task_details: tasksIncluded,
                    child_workplan_details: childWorkplansLoaded,
                    child_workplans_count: childWorkplansCount,
                    todays_tasks: includeTodaysTasks === "true",
                    todays_tasks_count: todaysTasksCount,
                    upcoming_tasks: includeUpcomingTasks === "true",
                    upcoming_tasks_count: upcomingTasksCount,
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
        console.error("Error getting checklist by duty roster:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Checklist By Duty Roster - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                duty_roster_id: request.params.dutyRosterId,
                error_type: error.name,
                error_message: error.message,
                error_stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                query_options: request.query,
            },
        });

        return reply.code(500).send({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
    }
};

module.exports = getChecklistByDutyRoster;