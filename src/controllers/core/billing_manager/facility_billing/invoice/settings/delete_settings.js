const payservedb = require("payservedb");

const delete_settings = async (request, reply) => {
  try {
    // Delete settings
    const result = await payservedb.CoreInvoiceSettings.deleteOne({});

    if (result.deletedCount === 0) {
      return reply.code(404).send({ error: "No billing settings found" });
    }

    return reply.code(200).send({
      message: "Billing settings deleted successfully",
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = delete_settings;
