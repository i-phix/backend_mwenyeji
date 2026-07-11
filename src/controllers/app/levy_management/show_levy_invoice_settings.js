const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const get_levy_settings = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Retrieve the model (same as in add_levy_settings)
    const levySettingsModel = await getModel(
      "InvoiceSettings",
      payservedb.InvoiceSettings.schema,
      facilityId
    );

    // Check if settings exist for the facility
    const settings = await levySettingsModel.findOne({ facilityId });

    if (!settings) {
      return reply.code(404).send({
        error: "Invoice settings not found for this facility",
      });
    }

    return reply.code(200).send({
      message: "Levy settings retrieved successfully",
      settings,
    });
  } catch (err) {
    console.error("Error in get_levy_settings:", err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_levy_settings;
