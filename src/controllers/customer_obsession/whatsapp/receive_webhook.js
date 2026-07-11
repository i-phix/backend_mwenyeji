const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const waConfig = require('../../../config/whatsapp');
const axios = require('axios');
const CommunicationSettings = require('../../../models/communication_settings');
const { matchAutoReplyRule } = require('../../../utils/auto_reply');

const normalizeChatId = (chatId = '') => {
  const clean = String(chatId || '').trim();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return `${clean.replace(/\D/g, '')}@c.us`;
};

const extractPhoneFromChatId = (chatId = '') => String(chatId).replace('@c.us', '').replace(/\D/g, '');

const buildFallbackMessageId = (chatId, ts, direction) => `${direction}_${chatId}_${ts}`;
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

const isOwnInstanceMessage = (body = {}, chatId = '') => {
  if (body?.messageData?.fromMe === true || body?.fromMe === true || body?.senderData?.isMe === true) {
    return true;
  }

  const ownNumbers = [
    process.env.GREEN_API_PHONE,
    process.env.GREEN_API_INSTANCE_PHONE,
    process.env.GREEN_API_INSTANCE_WAID,
    process.env.GREEN_API_OWN_NUMBER
  ]
    .map(digitsOnly)
    .filter(Boolean);

  if (!ownNumbers.length) return false;

  const senderCandidates = [
    body?.senderData?.sender,
    body?.senderData?.senderId,
    body?.senderData?.chatId,
    chatId
  ]
    .map(digitsOnly)
    .filter(Boolean);

  return senderCandidates.some((sender) => ownNumbers.includes(sender));
};

const resolveChatId = (body = {}, preferred = 'inbound') => {
  const senderCandidates = [
    body?.senderData?.sender,
    body?.senderData?.senderId,
    body?.senderData?.senderPhone,
    body?.senderData?.chatId
  ].filter(Boolean);

  const recipientCandidates = [
    body?.recipientData?.recipient,
    body?.recipientData?.recipientId,
    body?.recipientData?.chatId
  ].filter(Boolean);

  const ordered = preferred === 'outbound'
    ? recipientCandidates.concat(senderCandidates)
    : senderCandidates.concat(recipientCandidates);

  return ordered.find(Boolean) || '';
};

async function upsertConversation({
  waMessageId,
  chatId,
  contactName,
  contactPhone,
  direction,
  messageText,
  messageType = 'text',
  timestamp,
  isRead
}) {
  const normalizedChatId = normalizeChatId(chatId);
  if (!normalizedChatId) {
    return;
  }

  const resolvedTimestamp = timestamp ? new Date(timestamp) : new Date();
  const fallbackId = buildFallbackMessageId(normalizedChatId, resolvedTimestamp.getTime(), direction);
  const resolvedMessageId = waMessageId || fallbackId;

  await payservedb.WhatsappConversation.findOneAndUpdate(
    { wa_message_id: resolvedMessageId },
    {
      wa_message_id: resolvedMessageId,
      chat_id: normalizedChatId,
      contact_name: contactName,
      contact_phone: contactPhone || extractPhoneFromChatId(normalizedChatId),
      direction,
      message_text: messageText || '',
      message_type: messageType,
      timestamp: resolvedTimestamp,
      is_read: typeof isRead === 'boolean' ? isRead : direction === 'outbound'
    },
    { upsert: true, new: true }
  );
}

function parseGreenIncoming(body = {}) {
  const typeWebhook = body?.typeWebhook;
  const idMessage = body?.idMessage || body?.messageData?.idMessage || body?.messageData?.id || null;
  const inboundCandidate = resolveChatId(body, 'inbound');
  const outboundCandidate = resolveChatId(body, 'outbound');

  if (String(typeWebhook || '').includes('incomingMessage')) {
    const ownMessage = isOwnInstanceMessage(body, inboundCandidate);
    const chatId = ownMessage ? outboundCandidate || inboundCandidate : inboundCandidate;
    const senderName = body?.senderData?.senderName || body?.senderData?.chatName;
    const messageType = body?.messageData?.typeMessage || 'text';
    const messageText =
      body?.messageData?.textMessage ||
      body?.messageData?.textMessageData?.textMessage ||
      body?.messageData?.extendedTextMessageData?.text ||
      body?.messageData?.fileMessageData?.caption ||
      '';

    return {
      waMessageId: idMessage,
      chatId,
      contactName: senderName,
      contactPhone: extractPhoneFromChatId(chatId),
      direction: ownMessage ? 'outbound' : 'inbound',
      messageText,
      messageType,
      timestamp: body.timestamp ? Number(body.timestamp) * 1000 : Date.now(),
      isRead: ownMessage
    };
  }

  if (typeWebhook === 'outgoingAPIMessageReceived' || typeWebhook === 'outgoingMessageReceived' || String(typeWebhook || '').includes('outgoingMessage')) {
    const chatId = outboundCandidate || inboundCandidate;
    const messageType = body?.messageData?.typeMessage || 'text';
    const messageText =
      body?.messageData?.textMessage ||
      body?.messageData?.textMessageData?.textMessage ||
      body?.messageData?.extendedTextMessageData?.text ||
      body?.messageData?.fileMessageData?.caption ||
      '';

    return {
      waMessageId: idMessage,
      chatId,
      contactPhone: extractPhoneFromChatId(chatId),
      direction: 'outbound',
      messageText,
      messageType,
      timestamp: body.timestamp ? Number(body.timestamp) * 1000 : Date.now(),
      isRead: true
    };
  }

  return null;
}

function parseMetaIncoming(body = {}) {
  if (body.object !== 'whatsapp_business_account') {
    return [];
  }

  const rows = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      for (const msg of messages) {
        if (msg.type !== 'text') continue;
        const senderPhone = msg.from;
        const chatId = `${senderPhone}@c.us`;
        const contact = contacts.find((c) => c.wa_id === senderPhone);

        rows.push({
          waMessageId: msg.id,
          chatId,
          contactName: contact?.profile?.name || senderPhone,
          contactPhone: senderPhone,
          direction: 'inbound',
          messageText: msg.text?.body || '',
          messageType: msg.type || 'text',
          timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
          isRead: false
        });
      }
    }
  }

  return rows;
}

// GET handler for webhook verification/health
async function verify_webhook(request, reply) {
  if (waConfig.provider === 'green_api') {
    return reply.code(200).send({ success: true, provider: 'green_api' });
  }

  const mode = request.query['hub.mode'];
  const token = request.query['hub.verify_token'];
  const challenge = request.query['hub.challenge'];

  if (mode === 'subscribe' && token === waConfig.meta.verifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    return reply.code(200).send(parseInt(challenge, 10));
  }

  logger.warn('WhatsApp webhook verification failed');
  return reply.code(403).send({ error: 'Forbidden' });
}

async function receive_webhook(request, reply) {
  try {
    let body = request.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        logger.warn(`WhatsApp webhook body is non-JSON string: ${String(body).slice(0, 120)}`);
        return reply.code(200).send({ success: true });
      }
    }

    // Acknowledge quickly for all providers
    reply.code(200).send({ success: true });

    if (waConfig.provider === 'green_api') {
      const authHeader = waConfig.green.webhookAuthHeader;
      if (authHeader) {
        const incomingAuth = request.headers.authorization || request.headers.Authorization || '';
        if (incomingAuth !== authHeader) {
          logger.warn('Green API webhook auth header mismatch');
          return;
        }
      }

      const parsed = parseGreenIncoming(body);
      if (!parsed) {
        logger.info(`Green API webhook ignored (unsupported type): ${body?.typeWebhook || 'unknown'}`);
        return;
      }

      await upsertConversation(parsed);
      logger.info(`WhatsApp inbound webhook processed via Green API: ${parsed.direction} ${parsed.chatId}`);

      // Auto-reply for inbound messages — admin-managed AutoReplyRule
      // list (PR4). First keyword match wins. Matcher skips internal
      // staff phones via the CO_INTERNAL_WA_NUMBERS env var.
      if (parsed.direction === 'inbound') {
        try {
          const match = await matchAutoReplyRule({
            channel: 'whatsapp',
            body: parsed.messageText || '',
            senderPhone: parsed.contactPhone || parsed.chatId,
          });
          if (match) {
            const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
            await axios.post(
              `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
              { chatId: parsed.chatId, message: match.rule.reply },
              { headers: { 'Content-Type': 'application/json' } }
            );
            logger.info(`[auto-reply] whatsapp rule "${match.matched}" → ${parsed.chatId}`);
          }
        } catch (arErr) {
          logger.warn(`[auto-reply] whatsapp auto-reply failed: ${arErr.message}`);
        }
      }

      return;
    }

    const metaRows = parseMetaIncoming(body);
    for (const row of metaRows) {
      await upsertConversation(row);
      logger.info(`WhatsApp inbound message from ${row.contactPhone}: ${String(row.messageText).substring(0, 50)}`);
    }
  } catch (error) {
    logger.error(`Error processing WhatsApp webhook: ${error.message}`);
  }
}

module.exports = { verify_webhook, receive_webhook };
