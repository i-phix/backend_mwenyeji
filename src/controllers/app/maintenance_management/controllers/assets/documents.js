const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

// Add new document to an asset
const addDocument = async (request, reply) => {
  try {
    const { facilityId, assetId } = request.params;
    const { name, type, url } = request.body;

    // Validation
    if (!name || !type || !url) {
      return reply.code(400).send({
        error: "name, type, and url are required fields",
      });
    }

    // Validate type enum
    const validTypes = ["PDF", "Image", "Video"];
    if (!validTypes.includes(type)) {
      return reply.code(400).send({
        error: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    // Basic URL validation
    if (!url.trim()) {
      return reply.code(400).send({
        error: "url cannot be empty",
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
          documents: {
            name: name.trim(),
            type,
            url: url.trim(),
          },
        },
      },
      { new: true },
    );

    if (!updatedAsset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    return reply.code(200).send({
      message: "Document added successfully",
      asset: updatedAsset,
    });
  } catch (err) {
    console.error("Error in addDocument:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Edit specific document by index
const editDocument = async (request, reply) => {
  try {
    const { facilityId, assetId, documentIndex } = request.params;
    const updateData = request.body;

    const index = parseInt(documentIndex);
    if (isNaN(index) || index < 0) {
      return reply.code(400).send({
        error: "documentIndex must be a valid non-negative number",
      });
    }

    // Validate type enum if provided
    if (updateData.type) {
      const validTypes = ["PDF", "Image", "Video"];
      if (!validTypes.includes(updateData.type)) {
        return reply.code(400).send({
          error: `type must be one of: ${validTypes.join(", ")}`,
        });
      }
    }

    // Trim strings if provided
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.url) updateData.url = updateData.url.trim();

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const asset = await assetModel.findById(assetId);
    if (!asset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    if (index >= asset.documents.length) {
      return reply.code(404).send({ message: "Document not found" });
    }

    // Update the specific document
    Object.keys(updateData).forEach((key) => {
      asset.documents[index][key] = updateData[key];
    });

    await asset.save();

    return reply.code(200).send({
      message: "Document updated successfully",
      asset,
    });
  } catch (err) {
    console.error("Error in editDocument:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Delete specific document by index
const deleteDocument = async (request, reply) => {
  try {
    const { facilityId, assetId, documentIndex } = request.params;

    const index = parseInt(documentIndex);
    if (isNaN(index) || index < 0) {
      return reply.code(400).send({
        error: "documentIndex must be a valid non-negative number",
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

    if (index >= asset.documents.length) {
      return reply.code(404).send({ message: "Document not found" });
    }

    // Remove the document at the specified index
    asset.documents.splice(index, 1);
    await asset.save();

    return reply.code(200).send({
      message: "Document deleted successfully",
      asset,
    });
  } catch (err) {
    console.error("Error in deleteDocument:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get all documents for an asset
const getDocuments = async (request, reply) => {
  try {
    const { facilityId, assetId } = request.params;
    const { type } = request.query; // Optional filter by document type

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const asset = await assetModel
      .findById(assetId)
      .select("documents name serialNumber location");
    if (!asset) {
      return reply.code(404).send({ message: "Asset not found" });
    }

    let documents = asset.documents || [];

    // Filter by type if provided
    if (type) {
      const validTypes = ["PDF", "Image", "Video"];
      if (!validTypes.includes(type)) {
        return reply.code(400).send({
          error: `type must be one of: ${validTypes.join(", ")}`,
        });
      }
      documents = documents.filter((doc) => doc.type === type);
    }

    // Sort documents by name
    documents.sort((a, b) => a.name.localeCompare(b.name));

    return reply.code(200).send({
      message: "Documents retrieved successfully",
      documents,
      assetInfo: {
        name: asset.name,
        serialNumber: asset.serialNumber,
        location: asset.location,
      },
      count: documents.length,
    });
  } catch (err) {
    console.error("Error in getDocuments:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get specific document by index
const getDocument = async (request, reply) => {
  try {
    const { facilityId, assetId, documentIndex } = request.params;

    const index = parseInt(documentIndex);
    if (isNaN(index) || index < 0) {
      return reply.code(400).send({
        error: "documentIndex must be a valid non-negative number",
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

    if (index >= asset.documents.length) {
      return reply.code(404).send({ message: "Document not found" });
    }

    return reply.code(200).send({
      message: "Document retrieved successfully",
      document: asset.documents[index],
      assetInfo: {
        name: asset.name,
        serialNumber: asset.serialNumber,
        location: asset.location,
      },
    });
  } catch (err) {
    console.error("Error in getDocument:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get assets by document type
const getAssetsByDocumentType = async (request, reply) => {
  try {
    const { facilityId, type } = request.params;
    const { page = 1, limit = 50 } = request.query;

    // Validate type enum
    const validTypes = ["PDF", "Image", "Video"];
    if (!validTypes.includes(type)) {
      return reply.code(400).send({
        error: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const skip = (page - 1) * limit;

    const assets = await assetModel
      .find({
        facilityId,
        "documents.type": type,
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const totalAssets = await assetModel.countDocuments({
      facilityId,
      "documents.type": type,
    });

    return reply.code(200).send({
      message: `Assets with document type '${type}' retrieved successfully`,
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
    console.error("Error in getAssetsByDocumentType:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get document statistics for a facility
const getDocumentStatistics = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    const assets = await assetModel.find({ facilityId });

    let totalAssets = assets.length;
    let assetsWithDocuments = 0;
    let assetsWithoutDocuments = 0;
    let pdfCount = 0;
    let imageCount = 0;
    let videoCount = 0;
    let totalDocuments = 0;

    assets.forEach((asset) => {
      if (asset.documents && asset.documents.length > 0) {
        assetsWithDocuments++;
        totalDocuments += asset.documents.length;

        asset.documents.forEach((doc) => {
          if (doc.type === "PDF") pdfCount++;
          else if (doc.type === "Image") imageCount++;
          else if (doc.type === "Video") videoCount++;
        });
      } else {
        assetsWithoutDocuments++;
      }
    });

    return reply.code(200).send({
      message: "Document statistics retrieved successfully",
      statistics: {
        totalAssets,
        assetsWithDocuments,
        assetsWithoutDocuments,
        totalDocuments,
        documentTypeBreakdown: {
          pdf: pdfCount,
          image: imageCount,
          video: videoCount,
        },
        averageDocumentsPerAsset:
          totalAssets > 0 ? (totalDocuments / totalAssets).toFixed(2) : 0,
        documentationCoverage:
          totalAssets > 0
            ? ((assetsWithDocuments / totalAssets) * 100).toFixed(2)
            : 0,
      },
    });
  } catch (err) {
    console.error("Error in getDocumentStatistics:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  addDocument,
  editDocument,
  deleteDocument,
  getDocuments,
  getDocument,
  getAssetsByDocumentType,
  getDocumentStatistics,
};
