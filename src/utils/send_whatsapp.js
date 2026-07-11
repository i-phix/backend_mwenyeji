const axios = require('axios');
const payservedb = require('payservedb');
const logger = require('../../config/winston');
const waConfig = require('../config/whatsapp');
const { normalisePhone, isDeliverable } = require('./phone');

const isEnabled = () => String(process.env.UTILITY_WHATSAPP_ENABLED || '').toLowerCase() === 'true';

const buildChatId = (phone) => `${phone}@c.us`;

async function sendViaGreenApi(chatId, message) {
  const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
  if (!apiUrl || !idInstance || !apiTokenInstance) {
    throw new Error(`Green API not configured (apiUrl=${!!apiUrl} idInstance=${!!idInstance} apiTokenInstance=${!!apiTokenInstance})`);
  }
  const response = await axios.post(
    `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
    { chatId, message },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  return (
    response.data?.idMessage ||
    response.data?.idMessageData ||
    response.data?.messageData?.idMessage ||
    null
  );
}

async function sendViaMeta(chatId, message) {
  const recipientPhone = String(chatId).replace('@c.us', '').replace(/\D/g, '');
  const { apiBase, phoneNumberId, accessToken } = waConfig.meta;
  if (!apiBase || !phoneNumberId || !accessToken) {
    throw new Error(`Meta WhatsApp not configured (apiBase=${!!apiBase} phoneNumberId=${!!phoneNumberId} accessToken=${!!accessToken})`);
  }
  const response = await axios.post(
    `${apiBase}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: { body: message }
    },
    {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );
  return response.data?.messages?.[0]?.id || null;
}

/**
 * Send a WhatsApp message to a customer using the cops Green API (or Meta) config.
 * Best-effort: returns { success: false } on any failure instead of throwing.
 *
 *   phone        — raw phone string in any format (will be normalised)
 *   message      — text body
 *   opts.contactName  — optional name to store on the WhatsappConversation row
 *   opts.source       — short tag for telemetry; defaults to 'system-utility'
 */
async function sendWhatsappMessage(phone, message, opts = {}) {
  const src = opts.source || 'system-utility';

  if (!isEnabled()) {
    console.log(`[whatsapp] SKIP phone=${phone} source=${src} reason=UTILITY_WHATSAPP_ENABLED-not-true (currently='${process.env.UTILITY_WHATSAPP_ENABLED || ''}')`);
    return { success: false, skipped: true, reason: 'UTILITY_WHATSAPP_ENABLED is not true' };
  }
  if (!phone || !message) {
    console.log(`[whatsapp] SKIP source=${src} reason=missing-args phone=${!!phone} message=${!!message}`);
    return { success: false, reason: 'phone and message are required' };
  }

  const normalised = normalisePhone(phone);
  if (!isDeliverable(normalised)) {
    console.log(`[whatsapp] SKIP phone=${phone} source=${src} reason=not-deliverable normalised=${normalised}`);
    return { success: false, reason: `phone ${phone} is not deliverable` };
  }

  const chatId = buildChatId(normalised);
  console.log(`[whatsapp] SEND phone=${normalised} source=${src} provider=${waConfig.provider}`);

  try {
    let providerMessageId;
    if (waConfig.provider === 'meta') {
      providerMessageId = await sendViaMeta(chatId, message);
    } else {
      providerMessageId = await sendViaGreenApi(chatId, message);
    }

    try {
      await payservedb.WhatsappConversation.create({
        wa_message_id: providerMessageId,
        chat_id: chatId,
        contact_name: opts.contactName ? String(opts.contactName).trim() : undefined,
        contact_phone: normalised,
        direction: 'outbound',
        message_text: message,
        message_type: 'text',
        timestamp: new Date(),
        is_read: true,
        replied_by: null
      });
    } catch (logErr) {
      logger.warn(`[whatsapp] logging to WhatsappConversation failed: ${logErr.message}`);
    }

    console.log(`[whatsapp] OK phone=${normalised} source=${src} providerMessageId=${providerMessageId}`);
    return { success: true, providerMessageId, provider: waConfig.provider };
  } catch (error) {
    const errMsg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    console.warn(`[whatsapp] FAIL phone=${normalised} source=${src} error=${errMsg}`);
    logger.warn(`WhatsApp send to ${normalised} failed (${src}): ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

module.exports = { sendWhatsappMessage };
