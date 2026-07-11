const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { encrypt } = require('../../../utils/encryption');

const update_quickbooks_config = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      clientId,
      clientSecret,
      realmId,
      environment,
      isActive
    } = request.body;

    // Validate environment if provided
    if (environment && !['sandbox', 'production'].includes(environment)) {
      return reply.code(400).send({
        success: false,
        error: "Invalid environment. Must be 'sandbox' or 'production'",
      });
    }

    const QuickBooksConfigModel = await getModel(
      'QuickBooksConfig',
      payservedb.QuickBooksConfig.schema,
      facilityId
    );

    // Find existing configuration
    const config = await QuickBooksConfigModel.findOne({ facilityId });

    if (!config) {
      return reply.code(404).send({
        success: false,
        error: 'QuickBooks integration not found for this facility. Use add endpoint to create one.'
      });
    }

    // Build update object with only provided fields
    const updates = {};

    // Update non-sensitive fields
    if (clientId !== undefined) updates.clientId = clientId;
    if (realmId !== undefined) updates.realmId = realmId;
    if (environment !== undefined) updates.environment = environment;
    if (isActive !== undefined) updates.isActive = isActive;

    // Encrypt and update clientSecret if provided
    if (clientSecret !== undefined && clientSecret !== '') {
      updates.clientSecret = encrypt(clientSecret);
    }

    // Add user info if available
    if (request.user && request.user.userId) {
      updates.updatedBy = request.user.userId;
    }

    // Update the configuration
    Object.assign(config, updates);
    await config.save();

    // Return safe version (masked secrets)
    const safeConfig = config.toObject();
    safeConfig.clientSecret = '***MASKED***';

    return reply.code(200).send({
      success: true,
      message: 'QuickBooks integration updated successfully',
      data: {
        config: safeConfig,
      },
    });

  } catch (err) {
    console.error('Error in update_quickbooks_config:', err);

    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = update_quickbooks_config;