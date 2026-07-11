const axios = require('axios');
const payservedb = require('payservedb');
const waConfig = require('../../../config/whatsapp');
const CommunicationSettings = require('../../../models/communication_settings');
const logger = require('../../../../config/winston');
let pollerStarted = false;
let pollerRef = null;
let pullInProgress = false;
let lastPullAt = 0;
let lastGreenErrorKey = '';
let lastGreenErrorAt = 0;

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

function parseNotification(notification = {}) {
  const body = notification.body || notification;
  const typeWebhook = body?.typeWebhook;
  const idMessage = body?.idMessage || body?.messageData?.idMessage || null;
  const inboundCandidate = resolveChatId(body, 'inbound');
  const outboundCandidate = resolveChatId(body, 'outbound');
  if (!inboundCandidate && !outboundCandidate) return null;

  const messageText =
    body?.messageData?.textMessage ||
    body?.messageData?.textMessageData?.textMessage ||
    body?.messageData?.extendedTextMessageData?.text ||
    body?.messageData?.fileMessageData?.caption ||
    '';

  const messageType = body?.messageData?.typeMessage || 'text';
  const timestamp = body?.timestamp ? Number(body.timestamp) * 1000 : Date.now();

  if (String(typeWebhook || '').includes('incomingMessage')) {
    const ownMessage = isOwnInstanceMessage(body, inboundCandidate);
    const chatId = ownMessage ? outboundCandidate || inboundCandidate : inboundCandidate;
    return {
      waMessageId: idMessage,
      chatId,
      contactName: body?.senderData?.senderName || body?.senderData?.chatName || '',
      contactPhone: extractPhoneFromChatId(chatId),
      direction: ownMessage ? 'outbound' : 'inbound',
      messageText,
      messageType,
      timestamp,
      isRead: ownMessage
    };
  }

  if (String(typeWebhook || '').includes('outgoingMessage')) {
    const chatId = outboundCandidate || inboundCandidate;
    return {
      waMessageId: idMessage,
      chatId,
      contactPhone: extractPhoneFromChatId(chatId),
      direction: 'outbound',
      messageText,
      messageType,
      timestamp,
      isRead: true
    };
  }

  return null;
}

async function upsertConversation(row) {
  const normalizedChatId = normalizeChatId(row.chatId);
  if (!normalizedChatId) return { isNew: false };

  const ts = row.timestamp ? new Date(row.timestamp) : new Date();
  const msgId = row.waMessageId || buildFallbackMessageId(normalizedChatId, ts.getTime(), row.direction);

  const alreadyExists = await payservedb.WhatsappConversation.exists({ wa_message_id: msgId });

  await payservedb.WhatsappConversation.findOneAndUpdate(
    { wa_message_id: msgId },
    {
      wa_message_id: msgId,
      chat_id: normalizedChatId,
      contact_name: row.contactName,
      contact_phone: row.contactPhone || extractPhoneFromChatId(normalizedChatId),
      direction: row.direction,
      message_text: row.messageText || '',
      message_type: row.messageType || 'text',
      timestamp: ts,
      is_read: typeof row.isRead === 'boolean' ? row.isRead : row.direction === 'outbound'
    },
    { upsert: true, new: true }
  );

  return { isNew: !alreadyExists, normalizedChatId };
}

async function sendWaImmediateAutoReply(chatId, contactName, contactPhone) {
  try {
    const settings = await CommunicationSettings.findOne({ channel: 'whatsapp' }).lean();
    if (!settings?.auto_reply_enabled || !settings?.auto_reply_message) return;

    // Only send if there's been no outbound message in the last 24 hours (avoid spamming active chats)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentOutbound = await payservedb.WhatsappConversation.findOne({
      chat_id: chatId,
      direction: 'outbound',
      timestamp: { $gte: since24h }
    }).lean();
    if (recentOutbound) return; // agent/auto-reply already active in last 24h

    const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
    if (!apiUrl || !idInstance || !apiTokenInstance) return;

    await axios.post(
      `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
      { chatId, message: settings.auto_reply_message },
      { headers: { 'Content-Type': 'application/json' } }
    );

    // Record the auto-reply as an outbound message
    await payservedb.WhatsappConversation.create({
      chat_id: chatId,
      contact_name: contactName,
      contact_phone: contactPhone,
      direction: 'outbound',
      message_text: settings.auto_reply_message,
      message_type: 'text',
      timestamp: new Date(),
      is_read: true
    });

    logger.info(`[auto-reply] WA immediate auto-reply sent to ${chatId}`);
  } catch (err) {
    logger.warn(`[auto-reply] WA immediate auto-reply failed for ${chatId}: ${err.message}`);
  }
}

async function pullGreenNotifications(maxItems = 15, force = false) {
  if (waConfig.provider !== 'green_api') return;
  const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
  if (!apiUrl || !idInstance || !apiTokenInstance) return;
  const minGapMs = Number(process.env.GREEN_API_PULL_MIN_GAP_MS || 3000);
  const now = Date.now();

  if (!force && pullInProgress) return;
  if (!force && now - lastPullAt < minGapMs) return;

  try {
    pullInProgress = true;
    lastPullAt = now;

    for (let i = 0; i < maxItems; i += 1) {
      const receiveUrl = `${apiUrl}/waInstance${idInstance}/receiveNotification/${apiTokenInstance}`;
      const response = await axios.get(receiveUrl);

      const payload = response?.data;
      if (!payload) break;

      const receiptId = payload.receiptId;
      const parsed = parseNotification(payload);
      if (parsed) {
        const { isNew, normalizedChatId } = await upsertConversation(parsed);
        if (isNew && parsed.direction === 'inbound' && normalizedChatId && waConfig.provider === 'green_api') {
          sendWaImmediateAutoReply(normalizedChatId, parsed.contactName, parsed.contactPhone).catch(() => {});
        }
      }

      if (receiptId) {
        const deleteUrl = `${apiUrl}/waInstance${idInstance}/deleteNotification/${apiTokenInstance}/${receiptId}`;
        try {
          await axios.delete(deleteUrl, { headers: { 'Content-Type': 'application/json' } });
        } catch (deleteErr) {
          const status = deleteErr?.response?.status;
          const details = JSON.stringify(deleteErr?.response?.data || {});
          logger.warn(`Green notification delete failed (${status || 'unknown'}): ${details}`);
          break;
        }
      } else {
        break;
      }
    }
  } catch (error) {
    const status = error?.response?.status;
    const details = JSON.stringify(error?.response?.data || {});
    const errKey = `${status || ''}|${error.message}`;
    const nowTs = Date.now();
    if (errKey !== lastGreenErrorKey || (nowTs - lastGreenErrorAt) > 30000) {
      lastGreenErrorKey = errKey;
      lastGreenErrorAt = nowTs;
      logger.warn(`Green notification pull skipped (${status || 'unknown'}): ${error.message} ${details}`);
    }
  } finally {
    pullInProgress = false;
    lastPullAt = Date.now();
  }
}

function startGreenNotificationPoller() {
  if (waConfig.provider !== 'green_api') return;
  if (String(process.env.GREEN_API_POLLING_ENABLED || '').toLowerCase() !== 'true') {
    logger.info('Green notification poller disabled (webhook mode)');
    return;
  }
  if (pollerStarted) return;

  const intervalMs = Number(process.env.GREEN_API_PULL_INTERVAL_MS || 10000);
  pollerStarted = true;

  pollerRef = setInterval(() => {
    pullGreenNotifications().catch((error) => {
      logger.warn(`Green notification poller error: ${error.message}`);
    });
  }, intervalMs);

  if (typeof pollerRef.unref === 'function') {
    pollerRef.unref();
  }

  pullGreenNotifications(25, true).catch((error) => {
    logger.warn(`Green notification initial sync failed: ${error.message}`);
  });

  logger.info(`Green notification poller started at ${intervalMs}ms interval`);
}

module.exports = { pullGreenNotifications, startGreenNotificationPoller };
