const payservedb = require("payservedb");

const editFacilityPricing = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { levy, lease, powerMeters, waterMeters } = request.body;

    // Validate required fields
    if (
      levy == null ||
      lease == null ||
      powerMeters == null ||
      waterMeters == null
    ) {
      return reply.code(400).send({
        error: "Missing required fields: levy, lease, powerMeters, waterMeters",
      });
    }

    // Check if facility exists
    const facility = await payservedb.Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({
        error: "Facility not found",
      });
    }

    // Check if facility pricing exists
    const existingPricing = await payservedb.FacilityBillingPrice.findOne({
      facilityId,
    });

    if (!existingPricing) {
      return reply.code(404).send({
        error: "Facility pricing not found",
      });
    }

    // Update the pricing
    existingPricing.levy = levy;
    existingPricing.lease = lease;
    existingPricing.powerMeters = powerMeters;
    existingPricing.waterMeters = waterMeters;

    await existingPricing.save();

    return reply.code(200).send({
      message: "Facility pricing updated successfully",
      pricing: existingPricing,
    });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({
      error: "Internal server error",
    });
  }
};

module.exports = editFacilityPricing;
