const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const getDutyRosterChecklists = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            page = 1,
            limit = 10,
            staffId,
            status,
            startDate,
            endDate,
            completionRange,
            sortBy = "createdAt",
            sortOrder = "desc",
            includeTaskSummary = "true",
        } = request.query;

        // Validate pagination parameters
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Audit the checklists retrieval attempt
        await audit_trail(request, {
            activity: "Get Duty Roster Checklists",
            custom_data: {
                facility_id: facilityId,
                filters: {
                    staff_id: staffId || null,
                    status: status || null,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    completion_range: completionRange || null,
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    skip: skip,
                },
                sorting: {
                    sort_by: sortBy,
                    sort_order: sortOrder,
                },
                options: {
                    include_task_summary: includeTaskSummary,
                },
            },
        });

        // Validate status if provided
        const validStatuses = ["active", "completed", "expired", "cancelled"];
        if (status && !validStatuses.includes(status)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Get Duty Roster Checklists",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
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

        // Validate staffId format if provided
        if (staffId && !staffId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Get Duty Roster Checklists",
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

        const dutyRosterChecklistModel = await getModel(
            "DutyRosterChecklist",
            payservedb.DutyRosterChecklist.schema,
            facilityId,
        );

        // Build query filter
        const filter = { facilityId };

        if (staffId) {
            filter.staffId = staffId;
        }

        if (
            status &&
            ["active", "completed", "expired", "cancelled"].includes(status)
        ) {
            filter.status = status;
        }

        if (startDate || endDate) {
            filter["period.startDate"] = {};
            if (startDate) {
                filter["period.startDate"].$gte = new Date(startDate);
            }
            if (endDate) {
                filter["period.endDate"] = { $lte: new Date(endDate) };
            }
        }

        // Filter by completion range
        if (completionRange) {
            const [min, max] = completionRange.split("-").map(Number);
            if (!isNaN(min) && !isNaN(max)) {
                filter["summary.completionPercentage"] = {
                    $gte: min,
                    $lte: max,
                };
            }
        }

        // Build sort object
        const validSortFields = [
            "createdAt",
            "updatedAt",
            "period.startDate",
            "period.endDate",
            "summary.completionPercentage",
        ];
        const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
        const sortDirection = sortOrder === "asc" ? 1 : -1;
        const sort = { [sortField]: sortDirection };

        // Execute queries
        const [checklists, totalCount] = await Promise.all([
            dutyRosterChecklistModel
                .find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            dutyRosterChecklistModel.countDocuments(filter),
        ]);

        // Track enhancement metrics
        let staffDetailsLoaded = 0;
        let workplanDetailsLoaded = 0;
        let enhancementErrors = 0;

        // Enhance checklists with additional data
        const enhancedChecklists = await Promise.all(
            checklists.map(async (checklist) => {
                const enhanced = { ...checklist };

                // Add staff details
                try {
                    const staffUser = await payservedb.User.findById(checklist.staffId);
                    if (staffUser) {
                        enhanced.staffDetails = {
                            _id: staffUser._id,
                            fullName: staffUser.fullName,
                            email: staffUser.email,
                            role: staffUser.role,
                        };
                        staffDetailsLoaded++;
                    }
                } catch (error) {
                    console.error(`Error fetching staff user:`, error.message);
                    enhancementErrors++;
                }

                // Add master workplan details
                try {
                    const masterWorkplanModel = await getModel(
                        "MasterWorkplan",
                        payservedb.MasterWorkplan.schema,
                        facilityId,
                    );
                    const masterWorkplan = await masterWorkplanModel.findById(
                        checklist.masterWorkplanId,
                    );
                    if (masterWorkplan) {
                        enhanced.masterWorkplanDetails = {
                            _id: masterWorkplan._id,
                            title: masterWorkplan.title,
                            description: masterWorkplan.description,
                            status: masterWorkplan.status,
                        };
                        workplanDetailsLoaded++;
                    }
                } catch (error) {
                    console.error(`Error fetching master workplan:`, error.message);
                    enhancementErrors++;
                }

                // Add computed fields
                enhanced.computed = {
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
                };

                // Add task summary if requested
                if (includeTaskSummary === "true" && checklist.tasks) {
                    enhanced.taskSummary = {
                        totalTasks: checklist.tasks.length,
                        tasksByPriority: checklist.tasks.reduce((acc, task) => {
                            const priority = task.priority || "medium";
                            acc[priority] = (acc[priority] || 0) + 1;
                            return acc;
                        }, {}),
                        recurringTasks: checklist.tasks.filter((task) => task.isRecurring)
                            .length,
                        oneTimeTasks: checklist.tasks.filter((task) => !task.isRecurring)
                            .length,
                    };

                    // Today's tasks count
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    enhanced.taskSummary.todaysTasksCount = checklist.tasks.reduce(
                        (count, task) => {
                            return (
                                count +
                                task.scheduledDates.filter((scheduledDate) => {
                                    const taskDate = new Date(scheduledDate.date);
                                    taskDate.setHours(0, 0, 0, 0);
                                    return taskDate.getTime() === today.getTime();
                                }).length
                            );
                        },
                        0,
                    );
                }

                // Remove full task details for summary view
                if (includeTaskSummary === "true") {
                    delete enhanced.tasks;
                }

                return enhanced;
            }),
        );

        // Calculate summary statistics
        const summaryStats = {
            totalChecklists: totalCount,
            activeChecklists: enhancedChecklists.filter((c) => c.status === "active")
                .length,
            completedChecklists: enhancedChecklists.filter(
                (c) => c.status === "completed",
            ).length,
            expiredChecklists: enhancedChecklists.filter(
                (c) => c.status === "expired",
            ).length,
            averageCompletionRate:
                enhancedChecklists.length > 0
                    ? Math.round(
                        enhancedChecklists.reduce(
                            (sum, c) => sum + c.summary.completionPercentage,
                            0,
                        ) / enhancedChecklists.length,
                    )
                    : 0,
        };

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        // Audit successful checklists retrieval
        await audit_trail(request, {
            activity: "Get Duty Roster Checklists - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                filters_applied: {
                    staff_id: staffId || null,
                    status: status || null,
                    date_range: {
                        start_date: startDate || null,
                        end_date: endDate || null,
                    },
                    completion_range: completionRange || null,
                },
                results_summary: {
                    total_count: totalCount,
                    returned_count: enhancedChecklists.length,
                    page: pageNum,
                    total_pages: totalPages,
                    has_next_page: hasNextPage,
                    has_prev_page: hasPrevPage,
                },
                summary_statistics: summaryStats,
                enhancement_metrics: {
                    staff_details_loaded: staffDetailsLoaded,
                    workplan_details_loaded: workplanDetailsLoaded,
                    enhancement_errors: enhancementErrors,
                },
                sorting: {
                    sort_field: sortField,
                    sort_direction: sortOrder,
                },
                options: {
                    include_task_summary: includeTaskSummary === "true",
                },
            },
        });

        return reply.code(200).send({
            success: true,
            message: "Duty roster checklists retrieved successfully",
            data: {
                checklists: enhancedChecklists,
                summary: summaryStats,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalCount,
                    displayedCount: enhancedChecklists.length,
                    limit: limitNum,
                    hasNextPage,
                    hasPrevPage,
                    nextPage: hasNextPage ? pageNum + 1 : null,
                    prevPage: hasPrevPage ? pageNum - 1 : null,
                },
                filters: {
                    facilityId,
                    staffId: staffId || null,
                    status: status || null,
                    dateRange: {
                        startDate: startDate || null,
                        endDate: endDate || null,
                    },
                    completionRange: completionRange || null,
                },
                sorting: {
                    sortBy: sortField,
                    sortOrder,
                },
            },
            // Backwards compatibility
            checklists: enhancedChecklists,
            count: totalCount,
        });
    } catch (error) {
        console.error("Error getting duty roster checklists:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Duty Roster Checklists - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                error_type: error.name,
                error_message: error.message,
                error_stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                query_parameters: request.query,
            },
        });

        return reply.code(500).send({
            success: false,
            error: error.message,
        });
    }
};

module.exports = getDutyRosterChecklists;