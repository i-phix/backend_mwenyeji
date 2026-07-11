const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const getCommonAreaGeneratorReadingById = async (request, reply) => {
  try {
    const { facilityId, readingId } = request.params;

    const commonAreaGeneratorReadingModel = await getModel(
      "CommonAreaGeneratorReading",
      payservedb.CommonAreaGeneratorReading.schema,
      facilityId
    );

    const reading = await commonAreaGeneratorReadingModel.findById(readingId);

    if (!reading) {
      return reply.code(404).send({ message: "Common Area Generator Reading not found" });
    }

    return reply.code(200).send(reading);
  } catch (err) {
    console.error("Error in getCommonAreaGeneratorReadingById:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getCommonAreaGeneratorReadingById;