const payservedb = require("payservedb");

const getFacilityPricing = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Check if facility exists
    const facility = await payservedb.Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({
        error: "Facility not found",
      });
    }

    // Find facility pricing
    const pricing = await payservedb.FacilityBillingPrice.findOne({
      facilityId,
    });

    if (!pricing) {
      return reply.code(404).send({
        error: "Facility pricing not found",
      });
    }

    return reply.code(200).send({
      message: "Facility pricing retrieved successfully",
      pricing: pricing,
    });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({
      error: "Internal server error",
    });
  }
};

module.exports = getFacilityPricing;
