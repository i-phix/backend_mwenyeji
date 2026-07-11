const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const updateAssignedStatus = async (request, reply) => {
  try {
    const { facilityId, assetId } = request.params;
    const { assigned } = request.body;


    // Validate assigned field
    if (typeof assigned !== "boolean") {
      return reply.code(400).send({
        error: "assigned field must be a boolean value",
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const updatedAsset = await assetModel.findByIdAndUpdate(
      assetId,
      { assigned },
      { new: true, runValidators: true },
    );

    if (!updatedAsset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    return reply.code(200).send({
      message: `Asset ${assigned ? "assigned" : "unassigned"} successfully`,
      asset: updatedAsset,
    });
  } catch (err) {
    console.error("Error in updateAssignedStatus:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Bulk update assigned status for multiple assets
const updateMultipleAssignedStatus = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { assetIds, assigned } = request.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return reply.code(400).send({
        error: "assetIds must be a non-empty array",
      });
    }

    if (typeof assigned !== "boolean") {
      return reply.code(400).send({
        error: "assigned field must be a boolean value",
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const result = await assetModel.updateMany(
      { _id: { $in: assetIds }, facilityId },
      { $set: { assigned } },
    );

    return reply.code(200).send({
      message: `${result.modifiedCount} assets ${assigned ? "assigned" : "unassigned"} successfully`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    });
  } catch (err) {
    console.error("Error in updateMultipleAssignedStatus:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  updateAssignedStatus,
  updateMultipleAssignedStatus,
};
