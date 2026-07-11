const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const getDocumentTypes = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const documentTypeModel = await getModel(
      "DocumentType",
      payservedb.DocumentType.schema,
      facilityId
    );

    const documentTypes = await documentTypeModel
      .find({ facilityId })
      .sort({ createdAt: -1 });

    return reply.code(200).send({
      success: true,
      count: documentTypes.length,
      data: documentTypes || [], // Ensure data is always an array
    });
  } catch (err) {
    console.error("Error in getDocumentTypes:", err);
    return reply.code(400).send({
      success: false,
      error: err.message || "Failed to retrieve document types",
    });
  }
};

module.exports = getDocumentTypes;