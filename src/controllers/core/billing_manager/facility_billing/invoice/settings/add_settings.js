const payservedb = require("payservedb");

const add_settings = async (request, reply) => {
  try {
    const { header, footer } = request.body;

    // Check if settings already exist
    const existingSettings = await payservedb.CoreInvoiceSettings.findOne();
    if (existingSettings) {
      return reply
        .code(400)
        .send({ error: "Billing settings already exist" });
    }

    // Create new settings
    const newSettings = new payservedb.CoreInvoiceSettings({
      header,
      footer,
    });

    await newSettings.save();

    return reply.code(201).send({
      message: "Billing settings created successfully",
      settings: newSettings,
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_settings;