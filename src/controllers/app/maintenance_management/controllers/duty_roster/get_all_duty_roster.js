const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const getAllDutyRoster = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      page = 1,
      limit = 10,
      staffId,
      staffPosition,
      startDate,
      endDate,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      includeChecklist = "true", // New parameter to include checklist data
      checklistStatus, // Filter by checklist status
      completionRange, // Filter by completion percentage range (e.g., "0-50", "50-100")
    } = request.query;

    console.log("Fetching Duty Roster for Facility ID:", facilityId);

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
    const skip = (pageNum - 1) * limitNum;

    // Get all required models
    const dutyRosterModel = await getModel(
      "DutyRoster",
      payservedb.DutyRoster.schema,
      facilityId,
    );

    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );

    const dutyRosterChecklistModel = await getModel(
      "DutyRosterChecklist",
      payservedb.DutyRosterChecklist.schema,
      facilityId,
    );

    // Build query filters
    const query = { facilityId };

    // Filter by staff
    if (staffId) {
      query.staffId = staffId;
    }

    // Filter by staff position
    if (
      staffPosition &&
      ["Head", "Deputy", "Assistant", "Normal"].includes(staffPosition)
    ) {
      query.staffPosition = staffPosition;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.$and = query.$and || [];

      if (startDate) {
        query.$and.push({
          $or: [
            { startDate: { $gte: new Date(startDate) } },
            { endDate: { $gte: new Date(startDate) } },
          ],
        });
      }

      if (endDate) {
        query.$and.push({
          startDate: { $lte: new Date(endDate) },
        });
      }
    }

    // Filter by current active rosters
    if (status === "active") {
      const now = new Date();
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === "upcoming") {
      query.startDate = { $gt: new Date() };
    } else if (status === "expired") {
      query.endDate = { $lt: new Date() };
    }

    // Build sort object
    const validSortFields = [
      "createdAt",
      "updatedAt",
      "startDate",
      "endDate",
      "staffPosition",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    // Execute queries without populate
    const [entries, totalCount] = await Promise.all([
      dutyRosterModel.find(query).sort(sort).skip(skip).limit(limitNum).lean(), // Use lean for better performance
      dutyRosterModel.countDocuments(query),
    ]);

    console.log("Entries found:", entries.length, "out of", totalCount);

    // Get checklist data if requested
    let checklistData = {};
    if (includeChecklist === "true" && entries.length > 0) {
      const rosterIds = entries.map((entry) => entry._id);

      // Build checklist query
      const checklistQuery = {
        dutyRosterId: { $in: rosterIds },
      };

      // Filter by checklist status if provided
      if (
        checklistStatus &&
        ["active", "completed", "expired", "cancelled"].includes(
          checklistStatus,
        )
      ) {
        checklistQuery.status = checklistStatus;
      }

      // Filter by completion range if provided
      if (completionRange) {
        const [min, max] = completionRange.split("-").map(Number);
        if (!isNaN(min) && !isNaN(max)) {
          checklistQuery["summary.completionPercentage"] = {
            $gte: min,
            $lte: max,
          };
        }
      }

      const checklists = await dutyRosterChecklistModel
        .find(checklistQuery)
        .lean();

      // Create a map for quick lookup
      checklistData = checklists.reduce((acc, checklist) => {
        acc[checklist.dutyRosterId.toString()] = checklist;
        return acc;
      }, {});
    }

    // Manually populate the staff, master workplan, and checklist details
    const populatedEntries = await Promise.all(
      entries.map(async (entry) => {
        const populatedEntry = { ...entry };

        // Populate staff details
        if (entry.staffId) {
          try {
            const staffUser = await payservedb.User.findById(entry.staffId);
            if (staffUser) {
              populatedEntry.staffDetails = {
                _id: staffUser._id,
                fullName: staffUser.fullName,
                email: staffUser.email,
                phoneNumber: staffUser.phoneNumber,
                role: staffUser.role,
              };
              // Keep the original staffId reference
              populatedEntry.staffId = staffUser._id;
            }
          } catch (error) {
            console.error(
              `Error fetching staff user ${entry.staffId}:`,
              error.message,
            );
          }
        }

        // Populate master workplan details
        if (entry.masterWorkplanId) {
          try {
            const masterWorkplan = await masterWorkplanModel.findById(
              entry.masterWorkplanId,
            );
            if (masterWorkplan) {
              populatedEntry.masterWorkplanDetails = {
                _id: masterWorkplan._id,
                title: masterWorkplan.title,
                description: masterWorkplan.description,
                life: masterWorkplan.life,
                status: masterWorkplan.status,
              };
              // Keep the original masterWorkplanId reference
              populatedEntry.masterWorkplanId = masterWorkplan._id;
            }
          } catch (error) {
            console.error(
              `Error fetching master workplan ${entry.masterWorkplanId}:`,
              error.message,
            );
          }
        }

        // Add checklist information if available and requested
        if (includeChecklist === "true") {
          const checklist = checklistData[entry._id.toString()];
          if (checklist) {
            populatedEntry.checklistSummary = {
              _id: checklist._id,
              status: checklist.status,
              totalTasks: checklist.summary.totalTasks,
              completedTasks: checklist.summary.completedTasks,
              pendingTasks: checklist.summary.pendingTasks,
              missedTasks: checklist.summary.missedTasks,
              completionPercentage: checklist.summary.completionPercentage,
              period: checklist.period,
              lastUpdated: checklist.updatedAt,
            };

            // Add task breakdown by priority if available
            if (checklist.tasks) {
              const tasksByPriority = checklist.tasks.reduce((acc, task) => {
                const priority = task.priority || "medium";
                acc[priority] =
                  (acc[priority] || 0) + task.scheduledDates.length;
                return acc;
              }, {});

              populatedEntry.checklistSummary.tasksByPriority = tasksByPriority;
            }

            // Add today's tasks count
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            if (checklist.tasks) {
              const todaysTasksCount = checklist.tasks.reduce((count, task) => {
                return (
                  count +
                  task.scheduledDates.filter((scheduledDate) => {
                    const taskDate = new Date(scheduledDate.date);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate.getTime() === today.getTime();
                  }).length
                );
              }, 0);

              populatedEntry.checklistSummary.todaysTasksCount =
                todaysTasksCount;
            }
          } else {
            populatedEntry.checklistSummary = null;
          }
        }

        // Add calculated status based on dates
        const now = new Date();
        if (entry.startDate > now) {
          populatedEntry.calculatedStatus = "upcoming";
        } else if (entry.endDate < now) {
          populatedEntry.calculatedStatus = "expired";
        } else {
          populatedEntry.calculatedStatus = "active";
        }

        // Add duration in days
        populatedEntry.durationDays = Math.ceil(
          (new Date(entry.endDate) - new Date(entry.startDate)) /
            (1000 * 60 * 60 * 24),
        );

        return populatedEntry;
      }),
    );

    // Apply post-query filters if checklist data is involved
    let filteredEntries = populatedEntries;
    if (includeChecklist === "true" && (checklistStatus || completionRange)) {
      filteredEntries = populatedEntries.filter((entry) => {
        if (!entry.checklistSummary) return false;

        if (
          checklistStatus &&
          entry.checklistSummary.status !== checklistStatus
        ) {
          return false;
        }

        if (completionRange) {
          const [min, max] = completionRange.split("-").map(Number);
          if (!isNaN(min) && !isNaN(max)) {
            const completion = entry.checklistSummary.completionPercentage;
            if (completion < min || completion > max) {
              return false;
            }
          }
        }

        return true;
      });
    }

    // Calculate summary statistics
    const summaryStats = {
      totalRosters: totalCount,
      activeRosters: populatedEntries.filter(
        (e) => e.calculatedStatus === "active",
      ).length,
      upcomingRosters: populatedEntries.filter(
        (e) => e.calculatedStatus === "upcoming",
      ).length,
      expiredRosters: populatedEntries.filter(
        (e) => e.calculatedStatus === "expired",
      ).length,
    };

    // Add checklist statistics if included
    if (includeChecklist === "true") {
      const rostersWithChecklists = populatedEntries.filter(
        (e) => e.checklistSummary,
      );
      summaryStats.checklistStats = {
        rostersWithChecklists: rostersWithChecklists.length,
        rostersWithoutChecklists:
          populatedEntries.length - rostersWithChecklists.length,
        averageCompletionRate:
          rostersWithChecklists.length > 0
            ? Math.round(
                rostersWithChecklists.reduce(
                  (sum, e) => sum + e.checklistSummary.completionPercentage,
                  0,
                ) / rostersWithChecklists.length,
              )
            : 0,
        totalTasksAcrossAllRosters: rostersWithChecklists.reduce(
          (sum, e) => sum + e.checklistSummary.totalTasks,
          0,
        ),
        totalCompletedTasks: rostersWithChecklists.reduce(
          (sum, e) => sum + e.checklistSummary.completedTasks,
          0,
        ),
        totalPendingTasks: rostersWithChecklists.reduce(
          (sum, e) => sum + e.checklistSummary.pendingTasks,
          0,
        ),
        totalMissedTasks: rostersWithChecklists.reduce(
          (sum, e) => sum + e.checklistSummary.missedTasks,
          0,
        ),
      };
    }

    // Calculate pagination metadata (adjust for filtered results if applicable)
    const finalCount = filteredEntries.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Enhanced response with pagination and metadata
    const response = {
      success: true,
      message: "Duty Roster entries retrieved successfully",
      data: {
        entries: filteredEntries,
        summary: summaryStats,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          displayedCount: finalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null,
        },
        filters: {
          facilityId,
          staffId: staffId || null,
          staffPosition: staffPosition || null,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null,
          },
          status: status || null,
          includeChecklist: includeChecklist === "true",
          checklistStatus: checklistStatus || null,
          completionRange: completionRange || null,
        },
        sorting: {
          sortBy: sortField,
          sortOrder,
        },
      },
      // Backwards compatibility
      entries: filteredEntries,
      dutyRoster: filteredEntries,
      count: totalCount,
    };

    return reply.code(200).send(response);
  } catch (err) {
    console.error("Error fetching duty roster:", err);
    return reply.code(500).send({
      success: false,
      error: err.message,
      // Only include stack trace in development
      ...(process.env.NODE_ENV === "development" && { details: err.stack }),
    });
  }
};

module.exports = getAllDutyRoster;
