const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const edit_levy_settings = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { termsAndConditions, bankName, accountNumber } = request.body;

    if (!bankName || !accountNumber) {
      return reply.code(400).send({ error: "Missing required fields" });
    }

    const levySettingsModel = await getModel(
      "InvoiceSettings",
      payservedb.InvoiceSettings.schema,
      facilityId
    );

    const settings = await levySettingsModel.findOne({ facilityId });
    if (!settings) {
      return reply.code(404).send({ error: "Invoice settings not found" });
    }

    const updatedSettings = await levySettingsModel.findOneAndUpdate(
      { facilityId },
      { termsAndConditions, bankName, accountNumber },
      { new: true }
    );

    return reply.code(200).send({
      message: "Invoice settings updated successfully",
      settings: updatedSettings,
    });
  } catch (err) {
    console.error("Error in edit_levy_settings:", err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = edit_levy_settings;
