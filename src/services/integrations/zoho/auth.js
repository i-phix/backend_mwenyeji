/**
 * Zoho Books Authentication Module
 * Handles OAuth token management and refresh
 */

const axios = require('axios');
const { ZOHO_CONFIG, updateAccessToken } = require('./config');

/**
 * Token storage (in-memory)
 * In production, consider using Redis or database
 */
let tokenData = {
  accessToken: ZOHO_CONFIG.accessToken,
  refreshToken: ZOHO_CONFIG.refreshToken,
  expiresAt: null,
  lastRefreshed: null
};

if (!tokenData.refreshToken && ZOHO_CONFIG.refreshToken) {
  tokenData.refreshToken = ZOHO_CONFIG.refreshToken;
}
if (!tokenData.accessToken && ZOHO_CONFIG.accessToken) {
  tokenData.accessToken = ZOHO_CONFIG.accessToken;
}

/**
 * Refresh the access token using refresh token
 * @returns {Promise<string>} New access token
 */
async function refreshAccessToken() {
  try {
    console.log('🔄 Refreshing Zoho access token...');

    // ✅ Use URLSearchParams for proper form-encoded body
    const response = await axios.post(
      ZOHO_CONFIG.endpoints.token,
      new URLSearchParams({
        refresh_token: tokenData.refreshToken || ZOHO_CONFIG.refreshToken,
        client_id: ZOHO_CONFIG.clientId,
        client_secret: ZOHO_CONFIG.clientSecret,
        grant_type: 'refresh_token'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: ZOHO_CONFIG.requestTimeout
      }
    );

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      console.error('Zoho token response:', response.data); // ← helpful debug
      throw new Error('No access token received from Zoho');
    }

    tokenData.accessToken = access_token;
    tokenData.expiresAt = Date.now() + (expires_in * 1000);
    tokenData.lastRefreshed = new Date();
    updateAccessToken(access_token);

    console.log('✅ Zoho access token refreshed successfully');
    return access_token;

  } catch (error) {
    console.error('❌ Failed to refresh Zoho access token:', error.response?.data || error.message);
    throw {
      message: 'Failed to refresh Zoho access token',
      originalError: error.response?.data || error.message,
      code: 'TOKEN_REFRESH_FAILED'
    };
  }
}
/**
 * Check if token is expired or about to expire
 * @returns {boolean} True if token needs refresh
 */
function isTokenExpired() {
  if (!tokenData.expiresAt) {
    return true; // No expiry data, assume expired
  }

  // Refresh if token expires in less than 5 minutes
  const bufferTime = ZOHO_CONFIG.tokenExpiryBuffer * 1000; // Convert to milliseconds
  const expiryWithBuffer = tokenData.expiresAt - bufferTime;

  return Date.now() >= expiryWithBuffer;
}

/**
 * Get valid access token (refresh if needed)
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken() {
  if (!tokenData.accessToken || isTokenExpired()) {
    return await refreshAccessToken();
  }

  return tokenData.accessToken;
}

/**
 * Initialize token data with expiry calculation
 * @param {string} accessToken - Initial access token
 * @param {number} expiresIn - Token expiry in seconds (default: 3600)
 */
function initializeTokenData(accessToken, expiresIn = 3600) {
  tokenData.accessToken = accessToken;
  tokenData.expiresAt = Date.now() + (expiresIn * 1000);
  tokenData.lastRefreshed = new Date();

  updateAccessToken(accessToken);

  console.log('✅ Token data initialized');
}

/**
 * Get current token status
 * @returns {Object} Token status information
 */
function getTokenStatus() {
  const now = Date.now();
  const timeUntilExpiry = tokenData.expiresAt ? tokenData.expiresAt - now : null;
  console.log("+++++++++")
  console.log(tokenData.accessToken)
  return {
    hasAccessToken: !!tokenData.accessToken,
    hasRefreshToken: !!tokenData.refreshToken,
    isExpired: isTokenExpired(),
    expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
    timeUntilExpiry: timeUntilExpiry ? Math.floor(timeUntilExpiry / 1000) : null, // in seconds
    lastRefreshed: tokenData.lastRefreshed
  };
}

/**
 * Make authenticated request to Zoho API
 * Automatically handles token refresh if needed
 * @param {Object} config - Axios request config
 * @returns {Promise<Object>} API response
 */
async function authenticatedRequest(config) {
  const maxRetries = ZOHO_CONFIG.maxRetries;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get valid token (refresh if needed)
      const accessToken = await getValidAccessToken();

      // Make request with token
      const response = await axios({
        ...config,
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          ...config.headers
        },
        params: {
          organization_id: ZOHO_CONFIG.organizationId,
          ...config.params
        },
        timeout: ZOHO_CONFIG.requestTimeout
      });

      return response.data;

    } catch (error) {
      lastError = error;

      // Check if it's an authentication error
      const errorCode = error.response?.data?.code;
      const isAuthError = errorCode === 14 || errorCode === 57 || errorCode === 19;

      if (isAuthError && attempt < maxRetries) {
        console.log(`⚠️  Authentication error (attempt ${attempt}/${maxRetries}). Refreshing token...`);

        // Force token refresh
        tokenData.expiresAt = null;
        await refreshAccessToken();

        // Retry after delay
        await new Promise(resolve => setTimeout(resolve, ZOHO_CONFIG.retryDelay));
        continue;
      }

      // If not auth error or max retries reached, throw error
      throw {
        message: error.response?.data?.message || error.message,
        code: error.response?.data?.code || 'REQUEST_FAILED',
        details: error.response?.data,
        statusCode: error.response?.status
      };
    }
  }

  throw lastError;
}

/**
 * Validate current credentials by making test API call
 * @returns {Promise<boolean>} True if credentials are valid
 */
async function validateCredentials() {
  try {
    console.log('🔍 Validating Zoho credentials...');

    const response = await authenticatedRequest({
      method: 'GET',
      url: ZOHO_CONFIG.endpoints.organizations
    });

    if (response.code === 0 && response.organizations?.length > 0) {
      console.log('✅ Zoho credentials validated successfully');
      return true;
    }

    return false;

  } catch (error) {
    console.error('❌ Credential validation failed:', error.message);
    return false;
  }
}

/**
 * Update refresh token
 * @param {string} newRefreshToken - New refresh token
 */
function updateRefreshToken(newRefreshToken) {
  tokenData.refreshToken = newRefreshToken;
  console.log('✅ Refresh token updated');
}

module.exports = {
  refreshAccessToken,
  getValidAccessToken,
  isTokenExpired,
  initializeTokenData,
  getTokenStatus,
  authenticatedRequest,
  validateCredentials,
  updateRefreshToken
};
