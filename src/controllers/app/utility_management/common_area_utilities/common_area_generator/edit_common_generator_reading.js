const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const editCommonAreaGeneratorReading = async (request, reply) => {
  try {
    const { facilityId, readingId } = request.params;
    const updateData = request.body;

    const commonAreaGeneratorReadingModel = await getModel(
      "CommonAreaGeneratorReading",
      payservedb.CommonAreaGeneratorReading.schema,
      facilityId
    );
    
    const updatedReading = await commonAreaGeneratorReadingModel.findByIdAndUpdate(
      readingId,
      updateData,
      { new: true }
    );

    if (!updatedReading) {
      return reply.code(404).send({ message: "Common Area Generator Reading not found" });
    }

    return reply.code(200).send({
      message: "Common Area Generator Reading updated successfully",
      reading: updatedReading,
    });
  } catch (err) {
    console.error("Error in editCommonAreaGeneratorReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = editCommonAreaGeneratorReading;