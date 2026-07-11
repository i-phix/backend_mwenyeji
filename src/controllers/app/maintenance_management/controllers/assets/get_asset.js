const { getModel } = require("../../../../../utils/getModel");

const getAssetById = async (request, reply) => {
  try {
    const { facilityId, assetId } = request.params;
    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const asset = await assetModel.findById(assetId);
    if (!asset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    // Sort inspection certificates by date (most recent first)
    if (
      asset.inspection_certificate &&
      asset.inspection_certificate.length > 0
    ) {
      asset.inspection_certificate.sort(
        (a, b) => new Date(b.dateInspected) - new Date(a.dateInspected),
      );
    }

    // Sort documents by name for consistency
    if (asset.documents && asset.documents.length > 0) {
      asset.documents.sort((a, b) => a.name.localeCompare(b.name));
    }

    return reply.code(200).send({
      message: "Asset retrieved successfully",
      asset,
    });
  } catch (err) {
    console.error("Error in getAssetById:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getAssetById; // Fixed export name
// module.exports = getAsssetById;
