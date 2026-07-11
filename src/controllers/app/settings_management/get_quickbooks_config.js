const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const { mask, decrypt } = require("../../../utils/encryption");

const get_quickbooks_config = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { unmask } = request.query;

    const QuickBooksConfigModel = await getModel(
      "QuickBooksConfig",
      payservedb.QuickBooksConfig.schema,
      facilityId,
    );

    const config = await QuickBooksConfigModel.findOne({ facilityId });

    if (config) {
      // Check if unmask parameter is set to true
      const shouldUnmask = unmask === "true";

      // Return unmasked credentials if unmask=true, otherwise mask them
      let configData;

      if (shouldUnmask) {
        // Decrypt sensitive fields for editing
        const obj = config.toObject();
        configData = {
          ...obj,
          clientSecret: obj.clientSecret ? decrypt(obj.clientSecret) : null,
        };
      } else {
        // Mask sensitive fields for display
        configData = {
          ...config.toObject(),
          clientSecret: mask(config.clientSecret),
        };
      }

      return reply.code(200).send({
        success: true,
        data: {
          config: configData,
        },
      });
    } else {
      // No configuration found
      return reply.code(200).send({
        success: true,
        data: null,
        message: "No QuickBooks integration configured for this facility",
      });
    }
  } catch (err) {
    console.error("Error in get_quickbooks_config:", err);
    return reply.code(502).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = get_quickbooks_config;