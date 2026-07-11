const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const waConfig = require('../../../config/whatsapp');
const axios = require('axios');

const normalizeChatId = (chatId = '') => {
  const clean = String(chatId).trim();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return `${clean.replace(/\D/g, '')}@c.us`;
};

const extractPhoneFromChatId = (chatId = '') => String(chatId).replace('@c.us', '').replace(/\D/g, '');

async function sendViaGreenApi(chatId, messageText) {
  const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
  if (!apiUrl || !idInstance || !apiTokenInstance) {
    throw new Error('Green API is not configured. Set GREEN_API_URL, GREEN_API_ID_INSTANCE, GREEN_API_TOKEN');
  }

  const payload = {
    chatId,
    message: messageText
  };

  const response = await axios.post(
    `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data?.idMessage || response.data?.idMessageData || response.data?.messageData?.idMessage || null;
}

async function sendViaMeta(chatId, messageText) {
  const recipientPhone = extractPhoneFromChatId(chatId);
  const { apiBase, phoneNumberId, accessToken } = waConfig.meta;

  if (!apiBase || !phoneNumberId || !accessToken) {
    throw new Error('Meta WhatsApp is not configured. Set META_WA_* environment variables.');
  }

  const metaPayload = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'text',
    text: { body: messageText }
  };

  const metaResponse = await axios.post(
    `${apiBase}/${phoneNumberId}/messages`,
    metaPayload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return metaResponse.data?.messages?.[0]?.id || null;
}

async function send_message(request, reply) {
  try {
    const agent = request.user;
    const { chat_id, message_text, contact_name } = request.body;

    if (!chat_id || !message_text) {
      return reply.code(400).send({ success: false, error: 'chat_id and message_text are required' });
    }

    const normalizedChatId = normalizeChatId(chat_id);
    const recipientPhone = extractPhoneFromChatId(normalizedChatId);

    let providerMessageId = null;
    if (waConfig.provider === 'green_api') {
      providerMessageId = await sendViaGreenApi(normalizedChatId, message_text);
    } else {
      providerMessageId = await sendViaMeta(normalizedChatId, message_text);
    }

    await payservedb.WhatsappConversation.create({
      wa_message_id: providerMessageId,
      chat_id: normalizedChatId,
      contact_name: contact_name ? String(contact_name).trim() : undefined,
      contact_phone: recipientPhone,
      direction: 'outbound',
      message_text,
      message_type: 'text',
      timestamp: new Date(),
      is_read: true,
      replied_by: agent?.userId
    });

    logger.info(`WhatsApp message sent via ${waConfig.provider} to ${recipientPhone} by agent ${agent?.userId}`);

    return reply.code(200).send({
      success: true,
      message: 'Message sent successfully',
      data: {
        provider: waConfig.provider,
        message_id: providerMessageId
      }
    });
  } catch (error) {
    const errMsg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    logger.error(`Error sending WhatsApp message: ${errMsg}`);
    return reply.code(500).send({ success: false, error: `Failed to send WhatsApp message: ${errMsg}` });
  }
}

module.exports = send_message;
