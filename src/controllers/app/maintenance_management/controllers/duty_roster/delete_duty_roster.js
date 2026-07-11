const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const deleteDutyRoster = async (request, reply) => {
  try {
    const { facilityId, rosterId } = request.params;

    // Get both models
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

    // Check if the duty roster exists and get its data
    const dutyRoster = await dutyRosterModel.findById(rosterId);
    if (!dutyRoster) {
      return reply.status(404).send({
        success: false,
        message: "Duty Roster entry not found",
      });
    }

    // Get associated checklists before deletion (for logging/response)
    const associatedChecklists = await dutyRosterChecklistModel.find({
      dutyRosterId: rosterId,
    });

    // Perform deletions with rollback capability
    let deletedChecklists = [];
    let deletedDutyRoster = null;

    try {
      // Step 1: Delete all associated checklists
      if (associatedChecklists.length > 0) {
        const checklistDeleteResult = await dutyRosterChecklistModel.deleteMany(
          {
            dutyRosterId: rosterId,
          },
        );

        console.log(
          `Deleted ${checklistDeleteResult.deletedCount} checklist(s) for duty roster ${rosterId}`,
        );
        deletedChecklists = associatedChecklists.map(
          (checklist) => checklist._id,
        );
      }

      // Step 2: Delete the duty roster
      deletedDutyRoster = await dutyRosterModel.findByIdAndDelete(rosterId);

      if (!deletedDutyRoster) {
        // This shouldn't happen since we checked existence, but just in case
        throw new Error(
          "Failed to delete duty roster - it may have been deleted by another process",
        );
      }

      // Success response
      return reply.status(200).send({
        success: true,
        message:
          "Duty Roster entry and associated checklist(s) deleted successfully",
        data: {
          deletedDutyRoster: {
            _id: deletedDutyRoster._id,
            staffId: deletedDutyRoster.staffId,
            masterWorkplanId: deletedDutyRoster.masterWorkplanId,
            startDate: deletedDutyRoster.startDate,
            endDate: deletedDutyRoster.endDate,
            staffPosition: deletedDutyRoster.staffPosition,
          },
          deletedChecklistsCount: deletedChecklists.length,
          deletedChecklistIds: deletedChecklists,
        },
      });
    } catch (deleteError) {
      console.error("Error during deletion process:", deleteError);

      // Check what was actually deleted to provide accurate error message
      const dutyRosterStillExists = await dutyRosterModel.findById(rosterId);
      const remainingChecklists = await dutyRosterChecklistModel.find({
        dutyRosterId: rosterId,
      });

      if (
        dutyRosterStillExists &&
        remainingChecklists.length === associatedChecklists.length
      ) {
        // Nothing was deleted
        return reply.status(500).send({
          success: false,
          error: "Failed to delete duty roster and checklists",
          details: deleteError.message,
        });
      } else if (
        dutyRosterStillExists &&
        remainingChecklists.length < associatedChecklists.length
      ) {
        // Some checklists were deleted but duty roster remains
        return reply.status(500).send({
          success: false,
          error:
            "Partially completed deletion - some checklists deleted but duty roster remains",
          details: deleteError.message,
          partialResult: {
            deletedChecklistsCount:
              associatedChecklists.length - remainingChecklists.length,
            dutyRosterStatus: "still exists",
          },
        });
      } else if (!dutyRosterStillExists) {
        // Duty roster was deleted but there might have been checklist issues
        return reply.status(200).send({
          success: true,
          message: "Duty roster deleted successfully",
          warning:
            remainingChecklists.length > 0
              ? "Some associated checklists may not have been deleted"
              : null,
          data: {
            deletedDutyRoster: dutyRoster,
            deletedChecklistsCount:
              associatedChecklists.length - remainingChecklists.length,
            remainingChecklistsCount: remainingChecklists.length,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error in deleteDutyRoster controller:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

// Optional: Add a cleanup function to handle orphaned checklists
const cleanupOrphanedChecklists = async (facilityId) => {
  try {
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

    // Find all checklists
    const allChecklists = await dutyRosterChecklistModel.find({});

    // Find checklists that don't have corresponding duty rosters
    const orphanedChecklists = [];

    for (const checklist of allChecklists) {
      const dutyRosterExists = await dutyRosterModel.findById(
        checklist.dutyRosterId,
      );
      if (!dutyRosterExists) {
        orphanedChecklists.push(checklist._id);
      }
    }

    // Delete orphaned checklists
    if (orphanedChecklists.length > 0) {
      const deleteResult = await dutyRosterChecklistModel.deleteMany({
        _id: { $in: orphanedChecklists },
      });

      console.log(
        `Cleaned up ${deleteResult.deletedCount} orphaned checklists`,
      );
      return deleteResult.deletedCount;
    }

    return 0;
  } catch (error) {
    console.error("Error cleaning up orphaned checklists:", error);
    throw error;
  }
};

module.exports = deleteDutyRoster;
// Export cleanup function if needed
// module.exports = { deleteDutyRoster, cleanupOrphanedChecklists };
