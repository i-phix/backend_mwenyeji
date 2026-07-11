const { sendWhatsappMessage } = require('../../../utils/send_whatsapp');

/**
 * POST /api/internal/notifications/whatsapp
 *
 * Internal service-to-service endpoint used by water_meter_service and
 * water_billing_service to send WhatsApp messages through the cops Green API
 * config that lives on the backend. Protected by a shared bearer token.
 *
 * Body: { phone, message, facilityId?, contactName?, source? }
 */
async function send_whatsapp(request, reply) {
  try {
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expectedToken) {
      console.warn(`[whatsapp-endpoint] 503 reason=INTERNAL_SERVICE_TOKEN-not-configured`);
      return reply.code(503).send({ success: false, error: 'INTERNAL_SERVICE_TOKEN not configured' });
    }

    const authHeader = request.headers['authorization'] || '';
    const providedToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (providedToken !== expectedToken) {
      console.warn(`[whatsapp-endpoint] 401 reason=token-mismatch providedLen=${providedToken.length} expectedLen=${expectedToken.length}`);
      return reply.code(401).send({ success: false, error: 'Invalid service token' });
    }

    const { phone, message, contactName, source } = request.body || {};
    if (!phone || !message) {
      console.warn(`[whatsapp-endpoint] 400 reason=missing-args phone=${!!phone} message=${!!message} source=${source}`);
      return reply.code(400).send({ success: false, error: 'phone and message are required' });
    }

    console.log(`[whatsapp-endpoint] RECV phone=${phone} source=${source || 'unknown'}`);
    const result = await sendWhatsappMessage(phone, message, { contactName, source });
    return reply.code(200).send({ success: true, data: result });
  } catch (error) {
    console.error(`[whatsapp-endpoint] 500 error=${error.message}`);
    return reply.code(500).send({ success: false, error: error.message });
  }
}

module.exports = send_whatsapp;
