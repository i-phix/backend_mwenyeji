const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const { mask, decrypt } = require("../../../utils/encryption");

const get_zoho_config = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { unmask } = request.query;

    const ZohoIntegrationModel = await getModel(
      "ZohoIntegration",
      payservedb.ZohoIntegration.schema,
      facilityId,
    );

    const config = await ZohoIntegrationModel.findOne({ facilityId });

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
          refreshToken: obj.refreshToken ? decrypt(obj.refreshToken) : null,
          accessToken: obj.accessToken ? decrypt(obj.accessToken) : null,
        };
      } else {
        // Mask sensitive fields for display
        configData = config.toSafeObject
          ? config.toSafeObject()
          : {
              ...config.toObject(),
              clientSecret: mask(config.clientSecret),
              refreshToken: mask(config.refreshToken),
              accessToken: config.accessToken ? mask(config.accessToken) : null,
            };
      }

      // Calculate additional statistics
      const stats = {
        totalInvoicesSynced: config.totalInvoicesSynced || 0,
        totalPaymentsSynced: config.totalPaymentsSynced || 0,
        totalCustomersSynced: config.totalCustomersSynced || 0,
        successfulSyncs: config.successfulSyncs || 0,
        failedSyncs: config.failedSyncs || 0,
        syncSuccessRate: config.syncSuccessRate || 0,
      };

      return reply.code(200).send({
        success: true,
        data: {
          config: configData,
          stats: stats,
        },
      });
    } else {
      // No configuration found
      return reply.code(200).send({
        success: true,
        data: null,
        message: "No Zoho integration configured for this facility",
      });
    }
  } catch (err) {
    console.error("Error in get_zoho_config:", err);
    return reply.code(502).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = get_zoho_config;
