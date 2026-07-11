const payservedb = require("payservedb");
const logger = require("../../../../config/winston");

const get_facilities = async (request, reply) => {
  try {
    const facilities = await payservedb.Facility.find({});
    console.log("Facilities: ", facilities);
    logger.info(
      `Successfully extracted facilities: ${JSON.stringify(facilities)}`,
    );
    return reply.code(200).send(facilities);
  } catch (err) {
    logger.error(err.message);
    console.error(err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_facilities;
