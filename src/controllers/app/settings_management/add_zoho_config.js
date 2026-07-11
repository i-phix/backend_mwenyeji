const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const { encrypt } = require("../../../utils/encryption");

const add_zoho_config = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      clientId,
      clientSecret,
      refreshToken,
      accessToken,
      organizationId,
      autoSyncEnabled,
      syncInvoicesOnCreation,
      syncPaymentsOnReceipt,
      markInvoicesAsSent,
      syncFrequency,
      apiBaseUrl,
      requestTimeout,
      maxRetries,
      notes,
    } = request.body;

    // Validate required fields
    if (!clientId || !clientSecret || !refreshToken || !organizationId) {
      return reply.code(400).send({
        success: false,
        error:
          "Missing required fields: clientId, clientSecret, refreshToken, organizationId",
      });
    }

    const ZohoIntegrationModel = await getModel(
      "ZohoIntegration",
      payservedb.ZohoIntegration.schema,
      facilityId,
    );

    // Check if config already exists
    const existingConfig = await ZohoIntegrationModel.findOne({ facilityId });

    if (existingConfig) {
      return reply.code(409).send({
        success: false,
        error:
          "Zoho integration already exists for this facility. Use update endpoint instead.",
      });
    }

    // Encrypt sensitive fields
    const encryptedClientSecret = encrypt(clientSecret);
    const encryptedRefreshToken = encrypt(refreshToken);
    const encryptedAccessToken = accessToken ? encrypt(accessToken) : null;

    // Create configuration
    const configData = {
      facilityId,
      clientId,
      clientSecret: encryptedClientSecret,
      refreshToken: encryptedRefreshToken,
      organizationId,
      connectionStatus: "pending",
      isActive: true,
    };

    // Add optional fields if provided
    if (encryptedAccessToken) configData.accessToken = encryptedAccessToken;
    if (autoSyncEnabled !== undefined)
      configData.autoSyncEnabled = autoSyncEnabled;
    if (syncInvoicesOnCreation !== undefined)
      configData.syncInvoicesOnCreation = syncInvoicesOnCreation;
    if (syncPaymentsOnReceipt !== undefined)
      configData.syncPaymentsOnReceipt = syncPaymentsOnReceipt;
    if (markInvoicesAsSent !== undefined)
      configData.markInvoicesAsSent = markInvoicesAsSent;
    if (syncFrequency) configData.syncFrequency = syncFrequency;
    if (apiBaseUrl) configData.apiBaseUrl = apiBaseUrl;
    if (requestTimeout) configData.requestTimeout = requestTimeout;
    if (maxRetries !== undefined) configData.maxRetries = maxRetries;
    if (notes) configData.notes = notes;

    // Add user info if available
    if (request.user && request.user.userId) {
      configData.createdBy = request.user.userId;
      configData.updatedBy = request.user.userId;
    }

    const config = await ZohoIntegrationModel.create(configData);

    // Return safe version (masked secrets)
    const safeConfig = config.toSafeObject
      ? config.toSafeObject()
      : config.toObject();

    return reply.code(201).send({
      success: true,
      message: "Zoho integration configured successfully",
      data: safeConfig,
    });
  } catch (err) {
    console.error("Error in add_zoho_config:", err);

    // Handle duplicate key error
    if (err.code === 11000) {
      return reply.code(409).send({
        success: false,
        error: "Zoho integration already exists for this facility",
      });
    }

    return reply.code(502).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = add_zoho_config;
