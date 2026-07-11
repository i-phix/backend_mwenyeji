const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const getDutyRosterById = async (request, reply) => {
  try {
    const { facilityId, rosterId } = request.params;
    const {
      includeStats = false,
      includeChecklist = "true",
      includeTaskDetails = "false",
      includeTodaysTasks = "true",
      includeUpcomingTasks = "false",
    } = request.query;

    // Validate ObjectId format
    if (!rosterId.match(/^[0-9a-fA-F]{24}$/)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid roster ID format",
      });
    }

    console.log(
      `Fetching Duty Roster ID: ${rosterId} for Facility: ${facilityId}`,
    );

    // Get required models
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

    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      payservedb.ChildWorkplan.schema,
      facilityId,
    );

    // Find the duty roster without mongoose populate (we'll do manual population)
    const dutyRoster = await dutyRosterModel.findById(rosterId).lean();

    if (!dutyRoster) {
      return reply.status(404).send({
        success: false,
        message: "Duty Roster not found",
      });
    }

    // Verify the roster belongs to the specified facility
    if (dutyRoster.facilityId.toString() !== facilityId) {
      return reply.status(403).send({
        success: false,
        message: "Unauthorized: Roster does not belong to this facility",
      });
    }

    // Manually populate staff details
    let staffDetails = null;
    if (dutyRoster.staffId) {
      try {
        const staffUser = await payservedb.User.findById(dutyRoster.staffId);
        if (staffUser) {
          staffDetails = {
            _id: staffUser._id,
            fullName: staffUser.fullName,
            email: staffUser.email,
            phoneNumber: staffUser.phoneNumber,
            role: staffUser.role,
            type: staffUser.type,
          };
        }
      } catch (error) {
        console.error(`Error fetching staff user:`, error.message);
      }
    }

    // Manually populate master workplan details
    let masterWorkplanDetails = null;
    if (dutyRoster.masterWorkplanId) {
      try {
        const masterWorkplanModel = await getModel(
          "MasterWorkplan",
          payservedb.MasterWorkplan.schema,
          facilityId,
        );
        const masterWorkplan = await masterWorkplanModel.findById(
          dutyRoster.masterWorkplanId,
        );
        if (masterWorkplan) {
          masterWorkplanDetails = {
            _id: masterWorkplan._id,
            title: masterWorkplan.title,
            description: masterWorkplan.description,
            status: masterWorkplan.status,
            life: masterWorkplan.life,
          };
        }
      } catch (error) {
        console.error(`Error fetching master workplan:`, error.message);
      }
    }

    // Get checklist data if requested
    let checklistData = null;
    if (includeChecklist === "true") {
      try {
        const checklist = await dutyRosterChecklistModel
          .findOne({
            dutyRosterId: rosterId,
          })
          .lean();

        if (checklist) {
          checklistData = {
            _id: checklist._id,
            status: checklist.status,
            period: checklist.period,
            summary: checklist.summary,
            createdAt: checklist.createdAt,
            updatedAt: checklist.updatedAt,
          };

          // Include detailed task information if requested
          if (includeTaskDetails === "true" && checklist.tasks) {
            // Get child workplan details for tasks
            const childWorkplanIds = [
              ...new Set(checklist.tasks.map((task) => task.childWorkplanId)),
            ];
            const childWorkplans = await childWorkplanModel
              .find({
                _id: { $in: childWorkplanIds },
              })
              .lean();

            const childWorkplanMap = childWorkplans.reduce((map, child) => {
              map[child._id.toString()] = child;
              return map;
            }, {});

            checklistData.tasks = checklist.tasks.map((task) => ({
              _id: task._id,
              childWorkplanId: task.childWorkplanId,
              childWorkplanDetails:
                childWorkplanMap[task.childWorkplanId.toString()] || null,
              scheduledDates: task.scheduledDates,
              priority: task.priority,
              estimatedDuration: task.estimatedDuration,
              isRecurring: task.isRecurring,
              recurringPattern: task.recurringPattern,
            }));
          } else if (checklist.tasks) {
            // Just include task summary without full details
            checklistData.tasksSummary = {
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
          }

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
                  });
                }
              });
            });

            checklistData.todaysTasks = todaysTasks;
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
                  });
                }
              });
            });

            // Sort by date
            upcomingTasks.sort((a, b) => new Date(a.date) - new Date(b.date));
            checklistData.upcomingTasks = upcomingTasks;
          }
        }
      } catch (error) {
        console.error(`Error fetching checklist data:`, error.message);
      }
    }

    // Enhance the response with computed data
    const enhancedRoster = {
      ...dutyRoster,
      staffDetails,
      masterWorkplanDetails,
      checklist: checklistData,
      computed: {
        // Check if roster is currently active
        isActive:
          new Date() >= new Date(dutyRoster.startDate) &&
          new Date() <= new Date(dutyRoster.endDate),

        // Duration in days
        durationDays: Math.ceil(
          (new Date(dutyRoster.endDate) - new Date(dutyRoster.startDate)) /
            (1000 * 60 * 60 * 24),
        ),

        // Days remaining (if active) or days until start (if upcoming)
        daysRemaining: dutyRoster.endDate
          ? Math.ceil(
              (new Date(dutyRoster.endDate) - new Date()) /
                (1000 * 60 * 60 * 24),
            )
          : null,

        // Days until start (if upcoming)
        daysUntilStart: dutyRoster.startDate
          ? Math.ceil(
              (new Date(dutyRoster.startDate) - new Date()) /
                (1000 * 60 * 60 * 24),
            )
          : null,

        // Status based on dates
        status: (() => {
          const now = new Date();
          const start = new Date(dutyRoster.startDate);
          const end = new Date(dutyRoster.endDate);

          if (now < start) return "upcoming";
          if (now > end) return "expired";
          return "active";
        })(),

        // Count of exceptions
        exceptionsCount: dutyRoster.exceptions
          ? dutyRoster.exceptions.length
          : 0,

        // Weekly schedule summary
        weeklyScheduleSummary: (() => {
          const schedule = dutyRoster.weeklySchedule || {};
          const days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ];

          return days.reduce((summary, day) => {
            const daySchedule = schedule[day] || [];
            const onDutySlots = daySchedule.filter(
              (slot) => slot.status === "ON",
            ).length;
            const offDutySlots = daySchedule.filter(
              (slot) => slot.status === "OFF",
            ).length;

            summary[day] = {
              totalSlots: daySchedule.length,
              onDutySlots,
              offDutySlots,
              hasSchedule: daySchedule.length > 0,
            };

            return summary;
          }, {});
        })(),

        // Checklist performance metrics
        checklistPerformance: checklistData
          ? {
              hasChecklist: true,
              completionRate: checklistData.summary.completionPercentage,
              totalTasks: checklistData.summary.totalTasks,
              completedTasks: checklistData.summary.completedTasks,
              pendingTasks: checklistData.summary.pendingTasks,
              missedTasks: checklistData.summary.missedTasks,
              isOnTrack: checklistData.summary.completionPercentage >= 70, // Configurable threshold
              needsAttention: checklistData.summary.missedTasks > 0,
              todaysTasksCount: checklistData.todaysTasks
                ? checklistData.todaysTasks.length
                : 0,
              upcomingTasksCount: checklistData.upcomingTasks
                ? checklistData.upcomingTasks.length
                : 0,
            }
          : {
              hasChecklist: false,
            },
      },
    };

    // Add detailed statistics if requested
    if (includeStats === "true") {
      const schedule = dutyRoster.weeklySchedule || {};
      const allSlots = Object.values(schedule).flat();

      enhancedRoster.statistics = {
        // Schedule statistics
        totalWeeklySlots: allSlots.length,
        onDutySlots: allSlots.filter((slot) => slot.status === "ON").length,
        offDutySlots: allSlots.filter((slot) => slot.status === "OFF").length,
        leaveSlots: allSlots.filter((slot) =>
          ["AL", "CL", "ML/PL"].includes(slot.status),
        ).length,

        // Status breakdown
        statusBreakdown: allSlots.reduce((breakdown, slot) => {
          breakdown[slot.status] = (breakdown[slot.status] || 0) + 1;
          return breakdown;
        }, {}),

        // Upcoming exceptions
        upcomingExceptions: dutyRoster.exceptions
          ? dutyRoster.exceptions
              .filter((ex) => new Date(ex.date) >= new Date())
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .slice(0, 5)
          : [],

        // Checklist statistics (if checklist exists)
        checklistStatistics: checklistData
          ? {
              taskCompletionTrend: await calculateCompletionTrend(
                checklistData,
                dutyRoster,
              ),
              averageTaskDuration:
                await calculateAverageTaskDuration(checklistData),
              mostCommonTaskStatus: getMostCommonTaskStatus(checklistData),
              tasksByDay: await getTasksByDay(checklistData),
              overdueTasksCount: await getOverdueTasksCount(checklistData),
            }
          : null,
      };
    }

    return reply.status(200).send({
      success: true,
      message: "Duty Roster retrieved successfully",
      data: enhancedRoster,
    });
  } catch (err) {
    console.error("Error in getDutyRosterById:", err);
    return reply.status(500).send({
      success: false,
      error: err.message,
      // Only include stack trace in development
      ...(process.env.NODE_ENV === "development" && { details: err.stack }),
    });
  }
};

// Helper function to calculate completion trend
const calculateCompletionTrend = async (checklistData, dutyRoster) => {
  if (!checklistData.tasks) return null;

  const startDate = new Date(dutyRoster.startDate);
  const endDate = new Date(dutyRoster.endDate);
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil(
    (new Date() - startDate) / (1000 * 60 * 60 * 24),
  );

  const expectedCompletion = Math.min((daysPassed / totalDays) * 100, 100);
  const actualCompletion = checklistData.summary.completionPercentage;

  return {
    expectedCompletion: Math.round(expectedCompletion),
    actualCompletion: actualCompletion,
    isAhead: actualCompletion > expectedCompletion,
    isBehind: actualCompletion < expectedCompletion - 10, // 10% tolerance
    variance: Math.round(actualCompletion - expectedCompletion),
  };
};

// Helper function to calculate average task duration
const calculateAverageTaskDuration = async (checklistData) => {
  if (!checklistData.tasks) return null;

  const completedTasks = checklistData.tasks.flatMap((task) =>
    task.scheduledDates.filter(
      (date) => date.status === "completed" && date.actualDuration,
    ),
  );

  if (completedTasks.length === 0) return null;

  const totalDuration = completedTasks.reduce(
    (sum, task) => sum + task.actualDuration,
    0,
  );
  return Math.round(totalDuration / completedTasks.length);
};

// Helper function to get most common task status
const getMostCommonTaskStatus = (checklistData) => {
  if (!checklistData.tasks) return null;

  const statusCounts = checklistData.tasks
    .flatMap((task) => task.scheduledDates)
    .reduce((acc, date) => {
      acc[date.status] = (acc[date.status] || 0) + 1;
      return acc;
    }, {});

  const mostCommon = Object.entries(statusCounts).sort(
    ([, a], [, b]) => b - a,
  )[0];

  return mostCommon ? { status: mostCommon[0], count: mostCommon[1] } : null;
};

// Helper function to get tasks grouped by day
const getTasksByDay = async (checklistData) => {
  if (!checklistData.tasks) return {};

  const tasksByDay = {};

  checklistData.tasks.forEach((task) => {
    task.scheduledDates.forEach((scheduledDate) => {
      const dateKey = new Date(scheduledDate.date).toISOString().split("T")[0];
      if (!tasksByDay[dateKey]) {
        tasksByDay[dateKey] = {
          total: 0,
          completed: 0,
          pending: 0,
          missed: 0,
        };
      }
      tasksByDay[dateKey].total++;
      tasksByDay[dateKey][scheduledDate.status]++;
    });
  });

  return tasksByDay;
};

// Helper function to get overdue tasks count
const getOverdueTasksCount = async (checklistData) => {
  if (!checklistData.tasks) return 0;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return checklistData.tasks
    .flatMap((task) => task.scheduledDates)
    .filter(
      (scheduledDate) =>
        new Date(scheduledDate.date) < today &&
        ["pending", "in-progress"].includes(scheduledDate.status),
    ).length;
};

module.exports = getDutyRosterById;
