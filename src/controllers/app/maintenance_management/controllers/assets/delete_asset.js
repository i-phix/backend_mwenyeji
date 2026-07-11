const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const deleteAsset = async (request, reply) => {
  // Audit the delete attempt
  await audit_trail(request, {
    activity: "Delete Asset",
    custom_data: {
      facility_id: request.params.facilityId,
      asset_id: request.params.assetId,
    },
  });

  try {
    const { facilityId, assetId } = request.params;
    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );
    const deletedAsset = await assetModel.findByIdAndDelete(assetId);
    if (!deletedAsset) {
      // Audit asset not found
      await audit_trail(request, {
        activity: "Delete Asset - Not Found",
        custom_data: {
          facility_id: facilityId,
          asset_id: assetId,
          error: "Asset not found",
        },
      });

      return reply.code(404).send({ message: "Asset not found" });
    }

    // Audit successful deletion
    await audit_trail(request, {
      activity: "Delete Asset - Success",
      deleted_data: {
        id: deletedAsset._id,
        name: deletedAsset.name,
        location: deletedAsset.location,
        serialNumber: deletedAsset.serialNumber,
        dateBought: deletedAsset.dateBought,
        insuranceStatus: deletedAsset.insuranceStatus,
        assigned: deletedAsset.assigned,
        facilityId: deletedAsset.facilityId,
      },
      custom_data: {
        facility_id: facilityId,
        deleted_asset_id: deletedAsset._id,
        asset_name: deletedAsset.name,
        serial_number: deletedAsset.serialNumber,
      },
    });

    return reply.code(200).send({ message: "Asset deleted successfully" });
  } catch (err) {
    console.error("Error in deleteAsset:", err);

    // Audit the error
    await audit_trail(request, {
      activity: "Delete Asset - Failed",
      custom_data: {
        facility_id: request.params.facilityId,
        asset_id: request.params.assetId,
        error_type: err.name,
        error_message: err.message,
      },
    });

    return reply.code(400).send({ error: err.message });
  }
};
module.exports = deleteAsset;
