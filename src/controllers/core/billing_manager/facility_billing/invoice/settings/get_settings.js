const payservedb = require("payservedb");

const get_settings = async (request, reply) => {
  try {
    // Fetch the billing settings
    const settings = await payservedb.CoreInvoiceSettings.findOne();

    if (!settings) {
      return reply.code(404).send({ error: "Billing settings not found" });
    }

    return reply.code(200).send({
      success: true,
      data: {
        header: settings.header,
        footer: settings.footer,
      },
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_settings;
