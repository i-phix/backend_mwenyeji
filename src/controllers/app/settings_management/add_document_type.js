const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const addDocumentType = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { name } = request.body;

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: "Document Type name is required" });
    }

    const documentTypeModel = await getModel(
      "DocumentType",
      payservedb.DocumentType.schema,
      facilityId
    );

    // Check for duplicates within the same facility
    const existing = await documentTypeModel.findOne({
      facilityId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return reply.code(400).send({
        error: "Document Type already exists in this facility",
      });
    }

    const newDocumentType = await documentTypeModel.create({
      facilityId,
      name: name.trim(),
    });

    return reply.code(200).send({
      success: true,
      message: "Document Type added successfully",
      data: newDocumentType,
    });
  } catch (err) {
    console.error("Error in addDocumentType:", err);
    return reply.code(400).send({
      success: false,
      error: err.message || "Failed to add document type",
    });
  }
};

module.exports = addDocumentType;
