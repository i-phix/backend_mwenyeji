const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const add_levy_settings = async (request, reply) => {
  console.log('Received request:', {
    params: request.params,
    body: request.body
  });
  try {
    const { facilityId } = request.params;
    const settingsData = request.body;

    const levySettingsModel = await getModel(
      "InvoiceSettings",
      payservedb.InvoiceSettings.schema,
      facilityId
    );

    const existingSettings = await levySettingsModel.findOne({ facilityId });
    if (existingSettings) {
      return reply.code(409).send({
        error: "Settings already exist for this facility",
      });
    }

    const newSettings = await levySettingsModel.create({
      ...settingsData,
      facilityId,
    });

    return reply.code(201).send({
      message: "Levy settings added successfully",
      settings: newSettings,
    });
  } catch (err) {
    console.error("Error in add_levy_settings:", err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_levy_settings;
