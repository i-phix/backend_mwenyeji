const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

// Add new inspection certificate to an asset
const addInspectionCertificate = async (request, reply) => {
  try {
    const { facilityId, assetId } = request.params;
    const { dateInspected, status, certificate } = request.body;

    // Validation
    if (!dateInspected || !status || !certificate) {
      return reply.code(400).send({
        error: "dateInspected, status, and certificate are required fields",
      });
    }

    // Validate status enum
    const validStatuses = ["Passed", "Failed", "Pending"];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({
        error: `status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Validate date
    if (isNaN(Date.parse(dateInspected))) {
      return reply.code(400).send({
        error: "dateInspected must be a valid date",
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const updatedAsset = await assetModel.findByIdAndUpdate(
      assetId,
      {
        $push: {
          inspection_certificate: {
            dateInspected: new Date(dateInspected),
            status,
            certificate,
          },
        },
      },
      { new: true },
    );

    if (!updatedAsset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    return reply.code(200).send({
      message: "Inspection certificate added successfully",
      asset: updatedAsset,
    });
  } catch (err) {
    console.error("Error in addInspectionCertificate:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Edit specific inspection certificate by index
const editInspectionCertificate = async (request, reply) => {
  try {
    const { facilityId, assetId, certificateIndex } = request.params;
    const updateData = request.body;

    const index = parseInt(certificateIndex);
    if (isNaN(index) || index < 0) {
      return reply.code(400).send({
        error: "certificateIndex must be a valid non-negative number",
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const asset = await assetModel.findById(assetId);
    if (!asset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    if (index >= asset.inspection_certificate.length) {
      return reply
        .code(404)
        .send({ message: "Inspection certificate not found" });
    }

    // Update the specific certificate
    Object.keys(updateData).forEach((key) => {
      asset.inspection_certificate[index][key] = updateData[key];
    });

    await asset.save();

    return reply.code(200).send({
      message: "Inspection certificate updated successfully",
      asset,
    });
  } catch (err) {
    console.error("Error in editInspectionCertificate:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Delete specific inspection certificate by index
const deleteInspectionCertificate = async (request, reply) => {
  try {
    const { facilityId, assetId, certificateIndex } = request.params;

    const index = parseInt(certificateIndex);
    if (isNaN(index) || index < 0) {
      return reply.code(400).send({
        error: "certificateIndex must be a valid non-negative number",
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const asset = await assetModel.findById(assetId);
    if (!asset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    if (index >= asset.inspection_certificate.length) {
      return reply
        .code(404)
        .send({ message: "Inspection certificate not found" });
    }

    // Remove the certificate at the specified index
    asset.inspection_certificate.splice(index, 1);
    await asset.save();

    return reply.code(200).send({
      message: "Inspection certificate deleted successfully",
      asset,
    });
  } catch (err) {
    console.error("Error in deleteInspectionCertificate:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get all inspection certificates for an asset
const getInspectionCertificates = async (request, reply) => {
  try {
    const { facilityId, assetId } = request.params;

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const asset = await assetModel
      .findById(assetId)
      .select("inspection_certificate name serialNumber location");
    if (!asset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    // Sort certificates by date (most recent first)
    const sortedCertificates = asset.inspection_certificate.sort(
      (a, b) => new Date(b.dateInspected) - new Date(a.dateInspected),
    );

    return reply.code(200).send({
      message: "Inspection certificates retrieved successfully",
      certificates: sortedCertificates,
      assetInfo: {
        name: asset.name,
        serialNumber: asset.serialNumber,
        location: asset.location,
      },
      count: sortedCertificates.length,
    });
  } catch (err) {
    console.error("Error in getInspectionCertificates:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get specific inspection certificate by index
const getInspectionCertificate = async (request, reply) => {
  try {
    const { facilityId, assetId, certificateIndex } = request.params;

    const index = parseInt(certificateIndex);
    if (isNaN(index) || index < 0) {
      return reply.code(400).send({
        error: "certificateIndex must be a valid non-negative number",
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const asset = await assetModel.findById(assetId);
    if (!asset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    if (index >= asset.inspection_certificate.length) {
      return reply
        .code(404)
        .send({ message: "Inspection certificate not found" });
    }

    return reply.code(200).send({
      message: "Inspection certificate retrieved successfully",
      certificate: asset.inspection_certificate[index],
      assetInfo: {
        name: asset.name,
        serialNumber: asset.serialNumber,
        location: asset.location,
      },
    });
  } catch (err) {
    console.error("Error in getInspectionCertificate:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get assets filtered by inspection status
const getAssetsByInspectionStatus = async (request, reply) => {
  try {
    const { facilityId, status } = request.params;

    // Validate status enum
    const validStatuses = ["Passed", "Failed", "Pending"];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({
        error: `status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const assets = await assetModel.find({
      facilityId,
      "inspection_certificate.status": status,
    });

    return reply.code(200).send({
      message: `Assets with inspection status '${status}' retrieved successfully`,
      assets,
      count: assets.length,
    });
  } catch (err) {
    console.error("Error in getAssetsByInspectionStatus:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get assets with inspection alerts
const getInspectionAlerts = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { daysThreshold = 365 } = request.query; // Default to 1 year

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const assets = await assetModel.find({ facilityId });
    const alerts = [];
    const currentDate = new Date();

    assets.forEach((asset) => {
      let alertType = null;
      let latestCertificate = null;
      let daysSinceInspection = null;

      if (
        asset.inspection_certificate &&
        asset.inspection_certificate.length > 0
      ) {
        // Get the most recent certificate
        latestCertificate = asset.inspection_certificate.sort(
          (a, b) => new Date(b.dateInspected) - new Date(a.dateInspected),
        )[0];

        daysSinceInspection = Math.floor(
          (currentDate - new Date(latestCertificate.dateInspected)) /
            (1000 * 60 * 60 * 24),
        );

        // Determine alert type
        if (latestCertificate.status === "Failed") {
          alertType = "FAILED";
        } else if (latestCertificate.status === "Pending") {
          alertType = "PENDING";
        } else if (
          latestCertificate.status === "Passed" &&
          daysSinceInspection > daysThreshold
        ) {
          alertType = "INSPECTION_OVERDUE";
        }
      } else {
        // No certificates at all
        alertType = "NO_CERTIFICATES";
      }

      // Only add to alerts if there's an actual alert
      if (alertType) {
        alerts.push({
          asset: {
            _id: asset._id,
            name: asset.name,
            serialNumber: asset.serialNumber,
            location: asset.location,
            assigned: asset.assigned,
          },
          latestCertificate,
          daysSinceInspection,
          alertType,
        });
      }
    });

    return reply.code(200).send({
      message: "Inspection alerts retrieved successfully",
      alerts,
      count: alerts.length,
    });
  } catch (err) {
    console.error("Error in getInspectionAlerts:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get inspection statistics for a facility
const getInspectionStatistics = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const assets = await assetModel.find({ facilityId });

    let totalAssets = assets.length;
    let assetsWithCertificates = 0;
    let assetsWithoutCertificates = 0;
    let passedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    const currentDate = new Date();
    const oneYearAgo = new Date(
      currentDate.getTime() - 365 * 24 * 60 * 60 * 1000,
    );

    assets.forEach((asset) => {
      if (
        asset.inspection_certificate &&
        asset.inspection_certificate.length > 0
      ) {
        assetsWithCertificates++;

        // Get latest certificate
        const latestCert = asset.inspection_certificate.sort(
          (a, b) => new Date(b.dateInspected) - new Date(a.dateInspected),
        )[0];

        // Count by status
        if (latestCert.status === "Passed") {
          passedCount++;
          // Check if overdue (older than 1 year)
          if (new Date(latestCert.dateInspected) < oneYearAgo) {
            overdueCount++;
          }
        } else if (latestCert.status === "Failed") {
          failedCount++;
        } else if (latestCert.status === "Pending") {
          pendingCount++;
        }
      } else {
        assetsWithoutCertificates++;
      }
    });

    return reply.code(200).send({
      message: "Inspection statistics retrieved successfully",
      statistics: {
        totalAssets,
        assetsWithCertificates,
        assetsWithoutCertificates,
        certificateStatusBreakdown: {
          passed: passedCount,
          failed: failedCount,
          pending: pendingCount,
          overdue: overdueCount,
        },
        complianceRate:
          totalAssets > 0 ? ((passedCount / totalAssets) * 100).toFixed(2) : 0,
        coverage:
          totalAssets > 0
            ? ((assetsWithCertificates / totalAssets) * 100).toFixed(2)
            : 0,
      },
    });
  } catch (err) {
    console.error("Error in getInspectionStatistics:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  addInspectionCertificate,
  editInspectionCertificate,
  deleteInspectionCertificate,
  getInspectionCertificates,
  getInspectionCertificate,
  getAssetsByInspectionStatus,
  getInspectionAlerts,
  getInspectionStatistics,
};
