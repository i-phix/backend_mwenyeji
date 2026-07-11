const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const editCommonAreaElectricityReading = async (request, reply) => {
  try {
    const { facilityId, readingId } = request.params;
    const updateData = request.body;

    const commonAreaElectricityReadingModel = await getModel(
      "CommonAreaElectricityReading",
      payservedb.CommonAreaElectricityReading.schema,
      facilityId
    );
    
    const updatedReading = await commonAreaElectricityReadingModel.findByIdAndUpdate(
      readingId,
      updateData,
      { new: true }
    );

    if (!updatedReading) {
      return reply.code(404).send({ message: "Common Area Electricity Reading not found" });
    }

    return reply.code(200).send({
      message: "Common Area Electricity Reading updated successfully",
      reading: updatedReading,
    });
  } catch (err) {
    console.error("Error in editCommonAreaElectricityReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = editCommonAreaElectricityReading;