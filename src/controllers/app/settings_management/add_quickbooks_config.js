const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const { encrypt } = require("../../../utils/encryption");

const add_quickbooks_config = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      clientId,
      clientSecret,
      realmId,
      environment,
    } = request.body;

    // Validate required fields
    if (!clientId || !clientSecret || !realmId) {
      return reply.code(400).send({
        success: false,
        error: "Missing required fields: clientId, clientSecret, realmId",
      });
    }

    // Validate environment
    if (environment && !['sandbox', 'production'].includes(environment)) {
      return reply.code(400).send({
        success: false,
        error: "Invalid environment. Must be 'sandbox' or 'production'",
      });
    }

    const QuickBooksConfigModel = await getModel(
      "QuickBooksConfig",
      payservedb.QuickBooksConfig.schema,
      facilityId,
    );

    // Check if config already exists
    const existingConfig = await QuickBooksConfigModel.findOne({ facilityId });

    if (existingConfig) {
      return reply.code(409).send({
        success: false,
        error: "QuickBooks integration already exists for this facility. Use update endpoint instead.",
      });
    }

    // Encrypt sensitive fields
    const encryptedClientSecret = encrypt(clientSecret);

    // Create configuration
    const configData = {
      facilityId,
      clientId,
      clientSecret: encryptedClientSecret,
      realmId,
      environment: environment || 'sandbox',
      isActive: true,
    };

    // Add user info if available
    if (request.user && request.user.userId) {
      configData.createdBy = request.user.userId;
      configData.updatedBy = request.user.userId;
    }

    const config = await QuickBooksConfigModel.create(configData);

    // Return safe version (masked secrets)
    const safeConfig = config.toObject();
    safeConfig.clientSecret = '***MASKED***';

    return reply.code(201).send({
      success: true,
      message: "QuickBooks integration configured successfully",
      data: {
        config: safeConfig,
      },
    });
  } catch (err) {
    console.error("Error in add_quickbooks_config:", err);

    // Handle duplicate key error
    if (err.code === 11000) {
      return reply.code(409).send({
        success: false,
        error: "QuickBooks integration already exists for this facility",
      });
    }

    return reply.code(502).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = add_quickbooks_config;