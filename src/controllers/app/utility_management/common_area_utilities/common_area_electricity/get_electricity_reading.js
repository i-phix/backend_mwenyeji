const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const getCommonAreaElectricityReadingById = async (request, reply) => {
  try {
    const { facilityId, readingId } = request.params;

    const commonAreaElectricityReadingModel = await getModel(
      "CommonAreaElectricityReading",
      payservedb.CommonAreaElectricityReading.schema,
      facilityId
    );

    const reading = await commonAreaElectricityReadingModel.findById(readingId);

    if (!reading) {
      return reply.code(404).send({ message: "Common Area Electricity Reading not found" });
    }

    return reply.code(200).send(reading);
  } catch (err) {
    console.error("Error in getCommonAreaElectricityReadingById:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getCommonAreaElectricityReadingById;