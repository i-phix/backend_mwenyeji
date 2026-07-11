const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { encrypt } = require('../../../utils/encryption');

const update_zoho_config = async (request, reply) => {
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
      isActive
    } = request.body;

    const ZohoIntegrationModel = await getModel(
      'ZohoIntegration',
      payservedb.ZohoIntegration.schema,
      facilityId
    );

    // Find existing configuration
    const config = await ZohoIntegrationModel.findOne({ facilityId });

    if (!config) {
      return reply.code(404).send({
        success: false,
        error: 'Zoho integration not found for this facility. Use add endpoint to create one.'
      });
    }

    // Build update object with only provided fields
    const updates = {};

    // Update non-sensitive fields
    if (clientId !== undefined) updates.clientId = clientId;
    if (organizationId !== undefined) updates.organizationId = organizationId;
    if (autoSyncEnabled !== undefined) updates.autoSyncEnabled = autoSyncEnabled;
    if (syncInvoicesOnCreation !== undefined) updates.syncInvoicesOnCreation = syncInvoicesOnCreation;
    if (syncPaymentsOnReceipt !== undefined) updates.syncPaymentsOnReceipt = syncPaymentsOnReceipt;
    if (markInvoicesAsSent !== undefined) updates.markInvoicesAsSent = markInvoicesAsSent;
    if (syncFrequency !== undefined) updates.syncFrequency = syncFrequency;
    if (apiBaseUrl !== undefined) updates.apiBaseUrl = apiBaseUrl;
    if (requestTimeout !== undefined) updates.requestTimeout = requestTimeout;
    if (maxRetries !== undefined) updates.maxRetries = maxRetries;
    if (notes !== undefined) updates.notes = notes;
    if (isActive !== undefined) updates.isActive = isActive;

    // Encrypt and update sensitive fields if provided
    if (clientSecret !== undefined && clientSecret !== '') {
      updates.clientSecret = encrypt(clientSecret);
    }
    if (refreshToken !== undefined && refreshToken !== '') {
      updates.refreshToken = encrypt(refreshToken);
    }
    if (accessToken !== undefined) {
      updates.accessToken = accessToken ? encrypt(accessToken) : null;
    }

    // Add user info if available
    if (request.user && request.user.userId) {
      updates.updatedBy = request.user.userId;
      updates.lastModifiedBy = request.user.userId;
    }

    // Reset connection status if credentials changed
    if (clientSecret || refreshToken || accessToken) {
      updates.connectionStatus = 'pending';
      updates.connectionError = null;
    }

    // Update the configuration
    Object.assign(config, updates);
    await config.save();

    // Return safe version (masked secrets)
    const safeConfig = config.toSafeObject ? config.toSafeObject() : config.toObject();

    return reply.code(200).send({
      success: true,
      message: 'Zoho integration updated successfully',
      data: safeConfig
    });

  } catch (err) {
    console.error('Error in update_zoho_config:', err);

    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = update_zoho_config;
