const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const getCommonAreaWaterReadingById = async (request, reply) => {
  try {
    const { facilityId, readingId } = request.params;

    const commonAreaWaterReadingModel = await getModel(
      "CommonAreaWaterReading",
      payservedb.CommonAreaWaterReading.schema,
      facilityId
    );

    const reading = await commonAreaWaterReadingModel.findById(readingId);

    if (!reading) {
      return reply.code(404).send({ message: "Common Area Water Reading not found" });
    }

    return reply.code(200).send(reading);
  } catch (err) {
    console.error("Error in getCommonAreaWaterReadingById:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getCommonAreaWaterReadingById;