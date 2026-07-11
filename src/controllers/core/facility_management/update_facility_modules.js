const payservedb = require("payservedb");

const update_facility_modules = async (request, reply) => {
  try {
    const { id } = request.params;
    const { modules } = request.body;

    // DEBUG: Log the incoming data
    console.log("=== UPDATE FACILITY MODULES DEBUG ===");
    console.log("Facility ID:", id);
    console.log("Raw modules received:", modules);
    console.log("propertyManagement in modules:", modules?.propertyManagement);

    // Validate that modules object exists
    if (!modules) {
      return reply.code(400).send({
        error: "Modules data is required",
      });
    }

    // Ensure all module values are boolean
    const sanitizedModules = {
      visitor: Boolean(modules.visitor),
      levy: Boolean(modules.levy),
      maintenance: Boolean(modules.maintenance),
      propertyManagement: Boolean(modules.propertyManagement),
      lease: Boolean(modules.lease),
      vas: Boolean(modules.vas),
      tickets: Boolean(modules.tickets),
      utility: Boolean(modules.utility),
      booking: Boolean(modules.booking),
      handover: Boolean(modules.handover),
      expense: Boolean(modules.expense),
      campaign: Boolean(modules.campaign),
      procurement: Boolean(modules.procurement),
      accounts: Boolean(modules.accounts),
    };

    // DEBUG: Log the sanitized data
    console.log("Sanitized modules:", sanitizedModules);
    console.log("propertyManagement sanitized:", sanitizedModules.propertyManagement);

    const query = {
      _id: id,
    };

    const data = {
      modules: sanitizedModules,
    };

    // DEBUG: Log what we're about to save
    console.log("Query:", query);
    console.log("Data to save:", data);

    const result = await payservedb.Facility.updateOne(query, data);

    // DEBUG: Log the result
    console.log("Update result:", result);

    if (result.matchedCount === 0) {
      return reply.code(404).send({
        error: "Facility not found",
      });
    }

    // DEBUG: Verify the save by reading it back
    const updatedFacility = await payservedb.Facility.findById(id);
    console.log("Updated facility modules:", updatedFacility?.modules);
    console.log("propertyManagement after save:", updatedFacility?.modules?.propertyManagement);
    console.log("=== END DEBUG ===");

    return reply.code(200).send({
      success: true,
      message: "Facility Modules Updated successfully",
    });
  } catch (err) {
    console.error("Update facility modules error:", err); // Debug log
    return reply.code(502).send({
      error: err.message,
    });
  }
};

module.exports = update_facility_modules;