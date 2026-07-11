const greenApiUrl = process.env.GREEN_API_URL || process.env.GREEN_API_API_URL || '';
const greenMediaUrl = process.env.GREEN_API_MEDIA_URL || '';
const greenIdInstance = process.env.GREEN_API_ID_INSTANCE || process.env.GREEN_API_INSTANCE_ID || '';
const greenApiToken = process.env.GREEN_API_TOKEN || process.env.GREEN_API_API_TOKEN || process.env.GREEN_API_TOKEN_INSTANCE || '';

const providerFromEnv = (process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
const hasGreenConfig = Boolean(greenApiUrl && greenIdInstance && greenApiToken);
const hasMetaConfig = Boolean(
  process.env.META_WA_API_BASE || process.env.META_WA_PHONE_NUMBER_ID || process.env.META_WA_ACCESS_TOKEN
);

// Use Green API by default. Meta is used only when explicitly requested.
let provider = 'green_api';
if (providerFromEnv === 'meta') {
  provider = 'meta';
} else if (providerFromEnv === 'green_api') {
  provider = 'green_api';
} else if (!hasGreenConfig && hasMetaConfig) {
  provider = 'meta';
}

module.exports = {
  provider,

  // Green API
  green: {
    apiUrl: greenApiUrl,
    mediaUrl: greenMediaUrl,
    idInstance: greenIdInstance,
    apiTokenInstance: greenApiToken,
    webhookAuthHeader: process.env.GREEN_API_WEBHOOK_AUTH_HEADER || ''
  },

  // Meta fallback
  meta: {
    phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.META_WA_BUSINESS_ACCOUNT_ID || '',
    accessToken: process.env.META_WA_ACCESS_TOKEN || '',
    apiBase: process.env.META_WA_API_BASE || 'https://graph.facebook.com/v22.0',
    verifyToken: process.env.META_WA_VERIFY_TOKEN || 'payserve_whatsapp_webhook_2024'
  }
};
