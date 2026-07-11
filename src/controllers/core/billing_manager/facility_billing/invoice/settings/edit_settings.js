const payservedb = require("payservedb");

const edit_settings = async (request, reply) => {
  try {
    const { header, footer } = request.body;

    // Find and update settings
    const updatedSettings =
      await payservedb.CoreInvoiceSettings.findOneAndUpdate(
        {},
        { header, footer },
        { new: true, upsert: true }, // Create if not exists
      );

    return reply.code(200).send({
      message: "Billing settings updated successfully",
      settings: updatedSettings,
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = edit_settings;
