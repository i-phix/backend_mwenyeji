const payservedb = require("payservedb");

const { getModel } = require("../../../../../utils/getModel");

const getAssets = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      assigned,
      insuranceStatus,
      inspectionStatus,
      location,
      hasDocuments,
      documentType,
      page = 1,
      limit = 50,
    } = request.query;

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    // Build filter object
    const filter = { facilityId };

    if (assigned !== undefined) {
      filter.assigned = assigned === "true";
    }

    if (insuranceStatus) {
      filter.insuranceStatus = insuranceStatus;
    }

    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    if (inspectionStatus) {
      filter["inspection_certificate.status"] = inspectionStatus;
    }

    if (hasDocuments !== undefined) {
      if (hasDocuments === "true") {
        filter.documents = { $exists: true, $ne: [] };
      } else {
        filter.$or = [
          { documents: { $exists: false } },
          { documents: { $size: 0 } },
        ];
      }
    }

    if (documentType) {
      filter["documents.type"] = documentType;
    }

    // Pagination
    const skip = (page - 1) * limit;

    const assets = await assetModel
      .find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const totalAssets = await assetModel.countDocuments(filter);

    // Sort inspection certificates and documents for each asset
    assets.forEach((asset) => {
      if (
        asset.inspection_certificate &&
        asset.inspection_certificate.length > 0
      ) {
        asset.inspection_certificate.sort(
          (a, b) => new Date(b.dateInspected) - new Date(a.dateInspected),
        );
      }
      if (asset.documents && asset.documents.length > 0) {
        asset.documents.sort((a, b) => a.name.localeCompare(b.name));
      }
    });

    return reply.code(200).send({
      message: "Assets retrieved successfully",
      assets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalAssets / limit),
        totalAssets,
        hasNextPage: skip + assets.length < totalAssets,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Error in getAssets:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getAssets;
