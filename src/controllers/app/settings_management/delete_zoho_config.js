const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const delete_zoho_config = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { permanent } = request.query; // Optional query param to permanently delete

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
        error: 'Zoho integration not found for this facility'
      });
    }

    // Check if permanent deletion is requested
    if (permanent === 'true') {
      // Permanently delete the configuration
      await ZohoIntegrationModel.deleteOne({ facilityId });

      return reply.code(200).send({
        success: true,
        message: 'Zoho integration permanently deleted'
      });
    } else {
      // Soft delete - mark as inactive and disconnected
      config.isActive = false;
      config.connectionStatus = 'disconnected';

      // Add user info if available
      if (request.user && request.user.userId) {
        config.updatedBy = request.user.userId;
        config.lastModifiedBy = request.user.userId;
      }

      await config.save();

      return reply.code(200).send({
        success: true,
        message: 'Zoho integration disconnected successfully'
      });
    }

  } catch (err) {
    console.error('Error in delete_zoho_config:', err);

    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = delete_zoho_config;
