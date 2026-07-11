const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const editCommonAreaWaterReading = async (request, reply) => {
  try {
    const { facilityId, readingId } = request.params;
    const updateData = request.body;

    const commonAreaWaterReadingModel = await getModel(
      "CommonAreaWaterReading",
      payservedb.CommonAreaWaterReading.schema,
      facilityId
    );
    
    const updatedReading = await commonAreaWaterReadingModel.findByIdAndUpdate(
      readingId,
      updateData,
      { new: true }
    );

    if (!updatedReading) {
      return reply.code(404).send({ message: "Common Area Water Reading not found" });
    }

    return reply.code(200).send({
      message: "Common Area Water Reading updated successfully",
      reading: updatedReading,
    });
  } catch (err) {
    console.error("Error in editCommonAreaWaterReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = editCommonAreaWaterReading;