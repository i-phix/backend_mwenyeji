
const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const getChecklistAnalytics = async (request, reply) => {
    try {
        const { facilityId, checklistId } = request.params;
        const {
            includeTaskBreakdown = "true",
            includeTimeAnalysis = "true",
            includeProgressTrend = "true",
            includePredictions = "false",
        } = request.query;

        // Audit the analytics request attempt
        await audit_trail(request, {
            activity: "Get Checklist Analytics",
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                analysis_options: {
                    include_task_breakdown: includeTaskBreakdown,
                    include_time_analysis: includeTimeAnalysis,
                    include_progress_trend: includeProgressTrend,
                    include_predictions: includePredictions,
                },
            },
        });

        // Validate ObjectId format
        if (!checklistId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Get Checklist Analytics",
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
                activity: "Get Checklist Analytics",
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
                activity: "Get Checklist Analytics",
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

        const analytics = {};

        // Basic overview
        analytics.overview = {
            checklistId: checklist._id,
            status: checklist.status,
            period: checklist.period,
            summary: checklist.summary,
            createdAt: checklist.createdAt,
            lastUpdated: checklist.updatedAt,
        };

        // Performance metrics
        const now = new Date();
        const startDate = new Date(checklist.period.startDate);
        const endDate = new Date(checklist.period.endDate);
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const daysPassed = Math.max(
            0,
            Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)),
        );
        const expectedProgress = Math.min((daysPassed / totalDays) * 100, 100);

        analytics.performance = {
            expectedCompletionPercentage: Math.round(expectedProgress),
            actualCompletionPercentage: checklist.summary.completionPercentage,
            variance: Math.round(
                checklist.summary.completionPercentage - expectedProgress,
            ),
            isAheadOfSchedule:
                checklist.summary.completionPercentage > expectedProgress,
            isBehindSchedule:
                checklist.summary.completionPercentage < expectedProgress - 5, // 5% tolerance
            daysRemaining: Math.max(
                0,
                Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
            ),
            daysPassed: daysPassed,
            totalDays: totalDays,
        };

        // Task breakdown analysis
        if (includeTaskBreakdown === "true" && checklist.tasks) {
            const taskBreakdown = {
                byPriority: {},
                byStatus: {},
                byRecurringType: {
                    recurring: 0,
                    oneTime: 0,
                },
                byCompletionRate: {
                    fullyCompleted: 0,
                    partiallyCompleted: 0,
                    notStarted: 0,
                },
            };

            checklist.tasks.forEach((task) => {
                // Priority breakdown
                const priority = task.priority || "medium";
                if (!taskBreakdown.byPriority[priority]) {
                    taskBreakdown.byPriority[priority] = {
                        count: 0,
                        totalScheduledDates: 0,
                        completedDates: 0,
                        pendingDates: 0,
                        missedDates: 0,
                    };
                }
                taskBreakdown.byPriority[priority].count++;
                taskBreakdown.byPriority[priority].totalScheduledDates +=
                    task.scheduledDates.length;

                // Recurring type breakdown
                if (task.isRecurring) {
                    taskBreakdown.byRecurringType.recurring++;
                } else {
                    taskBreakdown.byRecurringType.oneTime++;
                }

                // Calculate completion rate for this task
                const completedDates = task.scheduledDates.filter(
                    (d) => d.status === "completed",
                ).length;
                const totalDates = task.scheduledDates.length;
                const taskCompletionRate =
                    totalDates > 0 ? (completedDates / totalDates) * 100 : 0;

                if (taskCompletionRate === 100) {
                    taskBreakdown.byCompletionRate.fullyCompleted++;
                } else if (taskCompletionRate > 0) {
                    taskBreakdown.byCompletionRate.partiallyCompleted++;
                } else {
                    taskBreakdown.byCompletionRate.notStarted++;
                }

                // Status breakdown
                task.scheduledDates.forEach((scheduledDate) => {
                    const status = scheduledDate.status;
                    if (!taskBreakdown.byStatus[status]) {
                        taskBreakdown.byStatus[status] = 0;
                    }
                    taskBreakdown.byStatus[status]++;

                    // Update priority status counts
                    if (scheduledDate.status === "completed") {
                        taskBreakdown.byPriority[priority].completedDates++;
                    } else if (
                        scheduledDate.status === "pending" ||
                        scheduledDate.status === "in-progress"
                    ) {
                        taskBreakdown.byPriority[priority].pendingDates++;
                    } else if (scheduledDate.status === "missed") {
                        taskBreakdown.byPriority[priority].missedDates++;
                    }
                });
            });

            analytics.taskBreakdown = taskBreakdown;
        }

        // Time analysis
        if (includeTimeAnalysis === "true" && checklist.tasks) {
            const timeAnalysis = {
                averageTaskDuration: 0,
                totalTimeSpent: 0,
                estimatedVsActualTime: {
                    totalEstimated: 0,
                    totalActual: 0,
                    variance: 0,
                },
                productivityMetrics: {
                    tasksCompletedPerDay: 0,
                    averageCompletionTime: 0,
                },
                peakProductivityHours: {},
                dailyProductivity: {},
                timeEfficiencyScore: 0,
            };

            let completedTasksWithDuration = 0;
            let totalActualDuration = 0;
            let totalEstimatedDuration = 0;
            let totalCompletedWithTime = 0;
            let totalTimeSpent = 0;
            let totalEstimatedTime = 0;

            checklist.tasks.forEach((task) => {
                if (task.estimatedDuration) {
                    totalEstimatedDuration +=
                        task.estimatedDuration * task.scheduledDates.length;
                    totalEstimatedTime +=
                        task.estimatedDuration *
                        task.scheduledDates.filter((d) => d.status === "completed").length;
                }

                task.scheduledDates.forEach((scheduledDate) => {
                    if (
                        scheduledDate.status === "completed" &&
                        scheduledDate.actualDuration
                    ) {
                        totalActualDuration += scheduledDate.actualDuration;
                        completedTasksWithDuration++;
                    }

                    if (scheduledDate.status === "completed") {
                        // Track completion by hour
                        if (scheduledDate.completedAt) {
                            const hour = new Date(scheduledDate.completedAt).getHours();
                            timeAnalysis.peakProductivityHours[hour] =
                                (timeAnalysis.peakProductivityHours[hour] || 0) + 1;
                        }

                        // Track completion by day
                        if (scheduledDate.completedAt) {
                            const day = new Date(scheduledDate.completedAt)
                                .toISOString()
                                .split("T")[0];
                            timeAnalysis.dailyProductivity[day] =
                                (timeAnalysis.dailyProductivity[day] || 0) + 1;
                        }

                        // Calculate time metrics
                        if (scheduledDate.actualDuration) {
                            totalTimeSpent += scheduledDate.actualDuration;
                            totalCompletedWithTime++;
                        }
                    }
                });
            });

            timeAnalysis.averageTaskDuration =
                completedTasksWithDuration > 0
                    ? Math.round(totalActualDuration / completedTasksWithDuration)
                    : 0;
            timeAnalysis.totalTimeSpent = totalActualDuration;
            timeAnalysis.estimatedVsActualTime = {
                totalEstimated: totalEstimatedDuration,
                totalActual: totalActualDuration,
                variance:
                    totalEstimatedDuration > 0
                        ? Math.round(
                            ((totalActualDuration - totalEstimatedDuration) /
                                totalEstimatedDuration) *
                            100,
                        )
                        : 0,
            };

            // Calculate productivity metrics
            if (daysPassed > 0) {
                timeAnalysis.productivityMetrics.tasksCompletedPerDay = (
                    checklist.summary.completedTasks / daysPassed
                ).toFixed(2);
            }

            timeAnalysis.productivityMetrics.averageCompletionTime =
                totalCompletedWithTime > 0
                    ? Math.round(totalTimeSpent / totalCompletedWithTime)
                    : 0;

            // Time efficiency score (actual vs estimated)
            if (totalEstimatedTime > 0 && totalTimeSpent > 0) {
                const efficiency = (totalEstimatedTime / totalTimeSpent) * 100;
                timeAnalysis.timeEfficiencyScore = Math.round(efficiency);
            }

            analytics.timeAnalysis = timeAnalysis;
        }

        // Progress trend analysis
        if (includeProgressTrend === "true" && checklist.tasks) {
            const progressTrend = {
                dailyProgress: {},
                weeklyTrend: [],
                milestones: [],
            };

            // Group completed tasks by date
            checklist.tasks.forEach((task) => {
                task.scheduledDates.forEach((scheduledDate) => {
                    if (
                        scheduledDate.status === "completed" &&
                        scheduledDate.completedAt
                    ) {
                        const completionDate = new Date(scheduledDate.completedAt)
                            .toISOString()
                            .split("T")[0];
                        if (!progressTrend.dailyProgress[completionDate]) {
                            progressTrend.dailyProgress[completionDate] = 0;
                        }
                        progressTrend.dailyProgress[completionDate]++;
                    }
                });
            });

            // Calculate weekly trends (last 4 weeks)
            const weeksBack = 4;
            for (let i = 0; i < weeksBack; i++) {
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - i * 7 - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);

                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);

                let weeklyCompletedTasks = 0;
                checklist.tasks.forEach((task) => {
                    task.scheduledDates.forEach((scheduledDate) => {
                        if (
                            scheduledDate.status === "completed" &&
                            scheduledDate.completedAt
                        ) {
                            const completionDate = new Date(scheduledDate.completedAt);
                            if (completionDate >= weekStart && completionDate <= weekEnd) {
                                weeklyCompletedTasks++;
                            }
                        }
                    });
                });

                progressTrend.weeklyTrend.unshift({
                    weekStart: weekStart.toISOString().split("T")[0],
                    weekEnd: weekEnd.toISOString().split("T")[0],
                    completedTasks: weeklyCompletedTasks,
                    weekNumber: weeksBack - i,
                });
            }

            // Define milestones (25%, 50%, 75%, 100%)
            const milestonePercentages = [25, 50, 75, 100];
            milestonePercentages.forEach((percentage) => {
                const targetTasks = Math.ceil(
                    (checklist.summary.totalTasks * percentage) / 100,
                );
                const isReached = checklist.summary.completedTasks >= targetTasks;

                progressTrend.milestones.push({
                    percentage,
                    targetTasks,
                    currentTasks: checklist.summary.completedTasks,
                    isReached,
                    remainingTasks: Math.max(
                        0,
                        targetTasks - checklist.summary.completedTasks,
                    ),
                });
            });

            analytics.progressTrend = progressTrend;
        }

        // Predictions and forecasting
        if (includePredictions === "true" && checklist.tasks && daysPassed > 0) {
            const predictions = {
                projectedCompletionDate: null,
                projectedCompletionPercentage: 0,
                recommendedDailyTasks: 0,
                riskAssessment: {
                    level: "low", // low, medium, high
                    factors: [],
                },
            };

            // Calculate completion rate per day
            const currentCompletionRate =
                checklist.summary.completedTasks / daysPassed;
            const remainingTasks =
                checklist.summary.totalTasks - checklist.summary.completedTasks;
            const daysRemaining = Math.max(
                0,
                Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
            );

            if (currentCompletionRate > 0 && remainingTasks > 0) {
                const daysToComplete = Math.ceil(
                    remainingTasks / currentCompletionRate,
                );
                const projectedDate = new Date();
                projectedDate.setDate(projectedDate.getDate() + daysToComplete);

                predictions.projectedCompletionDate = projectedDate
                    .toISOString()
                    .split("T")[0];

                // Calculate projected completion percentage by end date
                if (daysRemaining > 0) {
                    const tasksCanCompleteByEndDate = Math.floor(
                        currentCompletionRate * daysRemaining,
                    );
                    const finalProjectedTasks =
                        checklist.summary.completedTasks + tasksCanCompleteByEndDate;
                    predictions.projectedCompletionPercentage = Math.round(
                        (finalProjectedTasks / checklist.summary.totalTasks) * 100,
                    );
                }
            }

            // Recommended daily tasks to complete on time
            if (daysRemaining > 0 && remainingTasks > 0) {
                predictions.recommendedDailyTasks = Math.ceil(
                    remainingTasks / daysRemaining,
                );
            }

            // Risk assessment
            const missedTasksPercentage =
                (checklist.summary.missedTasks / checklist.summary.totalTasks) * 100;
            const completionVariance =
                checklist.summary.completionPercentage - expectedProgress;

            if (missedTasksPercentage > 15 || completionVariance < -20) {
                predictions.riskAssessment.level = "high";
                predictions.riskAssessment.factors.push(
                    "High number of missed tasks",
                    "Significantly behind schedule",
                );
            } else if (missedTasksPercentage > 5 || completionVariance < -10) {
                predictions.riskAssessment.level = "medium";
                predictions.riskAssessment.factors.push(
                    "Some missed tasks",
                    "Moderately behind schedule",
                );
            } else {
                predictions.riskAssessment.level = "low";
                predictions.riskAssessment.factors.push("On track");
            }

            // Additional risk factors
            if (daysRemaining < 7 && predictions.projectedCompletionPercentage < 90) {
                predictions.riskAssessment.factors.push(
                    "Tight deadline with incomplete tasks",
                );
            }

            if (predictions.recommendedDailyTasks > currentCompletionRate * 2) {
                predictions.riskAssessment.factors.push(
                    "Requires significant acceleration",
                );
            }

            analytics.predictions = predictions;
        }

        // Task-level insights
        if (includeTaskBreakdown === "true" && checklist.tasks) {
            const taskInsights = {
                mostProblematicTasks: [],
                bestPerformingTasks: [],
                tasksNeedingAttention: [],
            };

            checklist.tasks.forEach((task) => {
                const completedDates = task.scheduledDates.filter(
                    (d) => d.status === "completed",
                ).length;
                const missedDates = task.scheduledDates.filter(
                    (d) => d.status === "missed",
                ).length;
                const totalDates = task.scheduledDates.length;
                const completionRate =
                    totalDates > 0 ? (completedDates / totalDates) * 100 : 0;
                const missedRate =
                    totalDates > 0 ? (missedDates / totalDates) * 100 : 0;

                const taskInsight = {
                    taskId: task._id,
                    childWorkplanId: task.childWorkplanId,
                    priority: task.priority,
                    completionRate: Math.round(completionRate),
                    missedRate: Math.round(missedRate),
                    totalScheduledDates: totalDates,
                    completedDates,
                    missedDates,
                    pendingDates: task.scheduledDates.filter(
                        (d) => d.status === "pending",
                    ).length,
                };

                // Categorize tasks
                if (missedRate > 20 || (completionRate < 50 && totalDates > 5)) {
                    taskInsights.mostProblematicTasks.push(taskInsight);
                } else if (completionRate >= 90 && missedRate < 5) {
                    taskInsights.bestPerformingTasks.push(taskInsight);
                } else if (completionRate < 70 && totalDates > 3) {
                    taskInsights.tasksNeedingAttention.push(taskInsight);
                }
            });

            // Sort by most problematic first
            taskInsights.mostProblematicTasks.sort(
                (a, b) => b.missedRate - a.missedRate,
            );
            taskInsights.bestPerformingTasks.sort(
                (a, b) => b.completionRate - a.completionRate,
            );
            taskInsights.tasksNeedingAttention.sort(
                (a, b) => a.completionRate - b.completionRate,
            );

            analytics.taskInsights = taskInsights;
        }

        // Audit successful analytics retrieval
        await audit_trail(request, {
            activity: "Get Checklist Analytics - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                checklist_id: checklistId,
                checklist_status: checklist.status,
                total_tasks: checklist.summary?.totalTasks || 0,
                completed_tasks: checklist.summary?.completedTasks || 0,
                completion_percentage: checklist.summary?.completionPercentage || 0,
                analysis_included: {
                    task_breakdown: includeTaskBreakdown === "true",
                    time_analysis: includeTimeAnalysis === "true",
                    progress_trend: includeProgressTrend === "true",
                    predictions: includePredictions === "true",
                },
                performance_metrics: analytics.performance,
                analytics_summary: {
                    overview_generated: !!analytics.overview,
                    performance_calculated: !!analytics.performance,
                    task_breakdown_generated: !!analytics.taskBreakdown,
                    time_analysis_generated: !!analytics.timeAnalysis,
                    progress_trend_generated: !!analytics.progressTrend,
                    predictions_generated: !!analytics.predictions,
                    task_insights_generated: !!analytics.taskInsights,
                },
            },
        });

        return reply.code(200).send({
            success: true,
            message: "Checklist analytics retrieved successfully",
            data: {
                analytics,
                generatedAt: new Date().toISOString(),
                includedAnalysis: {
                    taskBreakdown: includeTaskBreakdown === "true",
                    timeAnalysis: includeTimeAnalysis === "true",
                    progressTrend: includeProgressTrend === "true",
                    predictions: includePredictions === "true",
                },
            },
        });
    } catch (error) {
        console.error("Error getting checklist analytics:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Checklist Analytics - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                checklist_id: request.params.checklistId,
                error_type: error.name,
                error_message: error.message,
                error_stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                analysis_options: request.query,
            },
        });

        return reply.code(500).send({
            success: false,
            error: error.message,
        });
    }
};

module.exports = getChecklistAnalytics;