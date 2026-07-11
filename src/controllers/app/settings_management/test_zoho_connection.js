const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { decrypt } = require('../../../utils/encryption');
const axios = require('axios');

const test_zoho_connection = async (request, reply) => {
  try {
    const { facilityId } = request.params;

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

    if (!config.isActive) {
      return reply.code(400).send({
        success: false,
        error: 'Zoho integration is not active'
      });
    }

    // Check if we need to refresh token first
    if (config.needsTokenRefresh && config.needsTokenRefresh()) {
      return reply.code(400).send({
        success: false,
        error: 'Access token expired. Please refresh credentials.',
        needsRefresh: true
      });
    }

    // Decrypt access token
    let accessToken;
    try {
      accessToken = config.accessToken ? decrypt(config.accessToken) : null;
    } catch (decryptError) {
      console.error('Failed to decrypt access token:', decryptError);
      return reply.code(500).send({
        success: false,
        error: 'Failed to decrypt access token'
      });
    }

    if (!accessToken) {
      return reply.code(400).send({
        success: false,
        error: 'No access token available. Please refresh credentials.'
      });
    }

    // Test connection to Zoho API
    try {
      const apiUrl = `${config.apiBaseUrl || 'https://www.zohoapis.com/books/v3'}/organizations`;

      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        },
        params: {
          organization_id: config.organizationId
        },
        timeout: config.requestTimeout || 30000
      });

      // Check if response is successful
      if (response.data && response.data.code === 0) {
        // Update connection status
        config.connectionStatus = 'connected';
        config.lastConnectionTest = new Date();
        config.connectionError = null;

        // Add user info if available
        if (request.user && request.user.userId) {
          config.lastModifiedBy = request.user.userId;
        }

        await config.save();

        return reply.code(200).send({
          success: true,
          message: 'Successfully connected to Zoho Books',
          data: {
            organizationName: response.data.organizations?.[0]?.name || 'N/A',
            organizationId: config.organizationId,
            connectionStatus: 'connected',
            lastTested: config.lastConnectionTest
          }
        });
      } else {
        throw new Error('Invalid response from Zoho API');
      }

    } catch (apiError) {
      // Connection test failed
      const errorMessage = apiError.response?.data?.message || apiError.message || 'Connection test failed';

      config.connectionStatus = 'error';
      config.connectionError = errorMessage;
      config.lastConnectionTest = new Date();

      // Add user info if available
      if (request.user && request.user.userId) {
        config.lastModifiedBy = request.user.userId;
      }

      await config.save();

      // Check for specific error codes
      const errorCode = apiError.response?.data?.code;

      if (errorCode === 14 || errorCode === 57 || errorCode === 19) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication failed. Please refresh your credentials.',
          details: errorMessage,
          needsRefresh: true
        });
      }

      return reply.code(503).send({
        success: false,
        error: 'Failed to connect to Zoho Books',
        details: errorMessage,
        connectionStatus: 'error'
      });
    }

  } catch (err) {
    console.error('Error in test_zoho_connection:', err);

    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = test_zoho_connection;
