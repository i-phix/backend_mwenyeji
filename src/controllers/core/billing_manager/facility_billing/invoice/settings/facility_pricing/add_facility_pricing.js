const payservedb = require("payservedb");

const addFacilityPricing = async (request, reply) => {
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

    // Check if facility already has pricing
    const existingPricing = await payservedb.FacilityBillingPrice.findOne({
      facilityId,
    });

    if (existingPricing) {
      return reply.code(400).send({
        error: "Facility already has a pricing plan",
      });
    }

    // Create new pricing
    const newPricing = new payservedb.FacilityBillingPrice({
      facilityId,
      levy,
      lease,
      powerMeters,
      waterMeters,
    });

    await newPricing.save();

    return reply.code(201).send({
      message: "Facility pricing added successfully",
      pricing: newPricing,
    });
  } catch (error) {
    console.error(error);
    return reply.code(500).send({
      error: "Internal server error",
    });
  }
};

module.exports = addFacilityPricing;
