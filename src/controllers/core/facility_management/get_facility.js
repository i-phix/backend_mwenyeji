const payservedb = require("payservedb");
const logger = require("../../../../config/winston");

const get_facility = async (request, reply) => {
  try {
    const { id } = request.params;
    // Find the facility by ID
    const facility = await payservedb.Facility.findById(id);

    if (!facility) {
      throw new Error(`Facility doesn't exist`);
    }
    // Fetch the related facility assets
    const facilityAssets = await payservedb.FacilityAsset.find({
      facilityId: id,
    });
    logger.info(`Successfully extracted facility: ` + JSON.stringify(facility));
    return reply.code(200).send({ facility, facilityAssets });
  } catch (err) {
    logger.error(err.message);
    console.log(err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_facility;
