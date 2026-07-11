const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const getTodaysTasks = async (request, reply) => {
    try {
        const { facilityId, staffId } = request.params;
        const {
            includeChildWorkplanDetails = "true",
            includeOverdue = "false",
            sortBy = "priority",
            sortOrder = "desc",
        } = request.query;

        // Audit the today's tasks retrieval attempt
        await audit_trail(request, {
            activity: "Get Today's Tasks",
            custom_data: {
                facility_id: facilityId,
                staff_id: staffId,
                query_options: {
                    include_child_workplan_details: includeChildWorkplanDetails,
                    include_overdue: includeOverdue,
                    sort_by: sortBy,
                    sort_order: sortOrder,
                },
            },
        });

        console.log(
            `Fetching today's tasks for staff: ${staffId} in facility: ${facilityId}`,
        );

        // Validate ObjectId format
        if (!staffId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Get Today's Tasks",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    error_type: "ValidationError",
                    error_message: "Invalid staff ID format",
                    invalid_staff_id: staffId,
                },
            });

            return reply.code(400).send({
                success: false,
                error: "Invalid staff ID format",
            });
        }

        // Validate sortBy if provided
        const validSortFields = ["priority", "date", "estimatedDuration", "status"];
        if (sortBy && !validSortFields.includes(sortBy)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Get Today's Tasks",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    staff_id: staffId,
                    error_type: "ValidationError",
                    error_message: `Invalid sortBy field. Must be one of: ${validSortFields.join(", ")}`,
                    invalid_sort_by: sortBy,
                    valid_sort_fields: validSortFields,
                },
            });

            return reply.code(400).send({
                success: false,
                error: `Invalid sortBy field. Must be one of: ${validSortFields.join(", ")}`,
            });
        }

        // Define date ranges
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dutyRosterChecklistModel = await getModel(
            "DutyRosterChecklist",
            payservedb.DutyRosterChecklist.schema,
            facilityId,
        );

        // Find all active checklists for this staff member
        const checklists = await dutyRosterChecklistModel
            .find({
                facilityId,
                staffId,
                status: "active",
            })
            .lean();

        console.log(
            `Found ${checklists.length} active checklists for staff member`,
        );

        // Extract today's tasks and overdue tasks if requested
        const todaysTasks = [];
        const overdueTasks = [];

        for (const checklist of checklists) {
            for (const task of checklist.tasks || []) {
                for (const scheduledDate of task.scheduledDates || []) {
                    const taskDate = new Date(scheduledDate.date);
                    taskDate.setHours(0, 0, 0, 0);

                    const isToday = taskDate.getTime() === today.getTime();
                    const isOverdue =
                        taskDate.getTime() < today.getTime() &&
                        ["pending", "in-progress"].includes(scheduledDate.status);

                    if (isToday || (includeOverdue === "true" && isOverdue)) {
                        const taskData = {
                            checklistId: checklist._id,
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
                            isRecurring: task.isRecurring,
                            recurringPattern: task.recurringPattern,
                            isOverdue: isOverdue,
                            daysOverdue: isOverdue
                                ? Math.ceil((today - taskDate) / (1000 * 60 * 60 * 24))
                                : 0,
                        };

                        if (isToday) {
                            todaysTasks.push(taskData);
                        } else if (isOverdue) {
                            overdueTasks.push(taskData);
                        }
                    }
                }
            }
        }

        console.log(
            `Found ${todaysTasks.length} today's tasks and ${overdueTasks.length} overdue tasks`,
        );

        let childWorkplansLoaded = false;
        let childWorkplansCount = 0;

        // Include child workplan details if requested
        if (
            includeChildWorkplanDetails === "true" &&
            (todaysTasks.length > 0 || overdueTasks.length > 0)
        ) {
            const allTasks = [...todaysTasks, ...overdueTasks];
            const childWorkplanIds = [
                ...new Set(allTasks.map((task) => task.childWorkplanId)),
            ];

            if (childWorkplanIds.length > 0) {
                try {
                    // FIXED: Use the correct model name
                    const childWorkplanModel = await getModel(
                        "ChildWorkplan", // Model registration name
                        payservedb.MasterWorkplanChild.schema, // Correct schema reference
                        facilityId,
                    );

                    const childWorkplans = await childWorkplanModel
                        .find({
                            _id: { $in: childWorkplanIds },
                        })
                        .lean();

                    console.log(`Found ${childWorkplans.length} child workplans`);
                    childWorkplansCount = childWorkplans.length;
                    childWorkplansLoaded = true;

                    const childWorkplanMap = childWorkplans.reduce((map, child) => {
                        map[child._id.toString()] = child;
                        return map;
                    }, {});

                    // Add child workplan details to tasks
                    todaysTasks.forEach((task, index) => {
                        todaysTasks[index].childWorkplanDetails =
                            childWorkplanMap[task.childWorkplanId.toString()] || null;
                    });

                    overdueTasks.forEach((task, index) => {
                        overdueTasks[index].childWorkplanDetails =
                            childWorkplanMap[task.childWorkplanId.toString()] || null;
                    });
                } catch (error) {
                    console.error("Error fetching child workplan details:", error);

                    // Audit child workplan loading error
                    await audit_trail(request, {
                        activity: "Get Today's Tasks",
                        response_status: "warning",
                        custom_data: {
                            facility_id: facilityId,
                            staff_id: staffId,
                            error_type: "ChildWorkplanLoadError",
                            error_message: error.message,
                            warning: "Failed to load child workplan details, continuing without them",
                        },
                    });
                }
            }
        }

        // Sort tasks based on parameters
        const sortTasks = (tasks) => {
            const validSortFields = [
                "priority",
                "date",
                "estimatedDuration",
                "status",
            ];
            const field = validSortFields.includes(sortBy) ? sortBy : "priority";
            const direction = sortOrder === "asc" ? 1 : -1;

            return tasks.sort((a, b) => {
                if (field === "priority") {
                    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                    return (
                        (priorityOrder[b.priority || "medium"] -
                            priorityOrder[a.priority || "medium"]) *
                        direction
                    );
                } else if (field === "date") {
                    return (new Date(a.date) - new Date(b.date)) * direction;
                } else if (field === "estimatedDuration") {
                    return (
                        ((a.estimatedDuration || 0) - (b.estimatedDuration || 0)) *
                        direction
                    );
                } else if (field === "status") {
                    return a.status.localeCompare(b.status) * direction;
                }
                return 0;
            });
        };

        const sortedTodaysTasks = sortTasks([...todaysTasks]);
        const sortedOverdueTasks = sortTasks([...overdueTasks]);

        // Calculate summary statistics
        const summary = {
            todaysTasksCount: todaysTasks.length,
            overdueTasksCount: overdueTasks.length,
            totalTasksCount: todaysTasks.length + overdueTasks.length,
            tasksByStatus: {
                pending: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.status === "pending",
                ).length,
                inProgress: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.status === "in-progress",
                ).length,
                completed: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.status === "completed",
                ).length,
                missed: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.status === "missed",
                ).length,
            },
            tasksByPriority: {
                critical: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.priority === "critical",
                ).length,
                high: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.priority === "high",
                ).length,
                medium: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.priority === "medium",
                ).length,
                low: [...todaysTasks, ...overdueTasks].filter(
                    (t) => t.priority === "low",
                ).length,
            },
            estimatedTotalDuration: [...todaysTasks, ...overdueTasks].reduce(
                (total, task) => total + (task.estimatedDuration || 0),
                0,
            ),
        };

        // Audit successful tasks retrieval
        await audit_trail(request, {
            activity: "Get Today's Tasks - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                staff_id: staffId,
                date: today.toISOString().split("T")[0],
                active_checklists_found: checklists.length,
                tasks_summary: {
                    todays_tasks_count: todaysTasks.length,
                    overdue_tasks_count: overdueTasks.length,
                    total_tasks_count: todaysTasks.length + overdueTasks.length,
                },
                tasks_by_status: summary.tasksByStatus,
                tasks_by_priority: summary.tasksByPriority,
                estimated_total_duration: summary.estimatedTotalDuration,
                data_included: {
                    child_workplan_details: childWorkplansLoaded,
                    child_workplans_count: childWorkplansCount,
                    overdue_tasks_included: includeOverdue === "true",
                },
                sorting: {
                    sort_by: sortBy,
                    sort_order: sortOrder,
                },
            },
        });

        return reply.code(200).send({
            success: true,
            message: "Today's tasks retrieved successfully",
            data: {
                todaysTasks: sortedTodaysTasks,
                overdueTasks: includeOverdue === "true" ? sortedOverdueTasks : [],
                summary,
                date: today.toISOString().split("T")[0],
                includeOverdue: includeOverdue === "true",
            },
        });
    } catch (error) {
        console.error("Error getting today's tasks:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Today's Tasks - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                staff_id: request.params.staffId,
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

module.exports = getTodaysTasks;