const axios = require('axios');
const nodemailer = require('nodemailer');
const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const emailConfig = require('../../../config/email');
const waConfig = require('../../../config/whatsapp');
const { getAlwaysCcAddresses, mergeCcLists } = require('../../../utils/email_cc');
const { normalisePhone } = require('../../../utils/phone');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const transporter = nodemailer.createTransport(emailConfig.smtp);

function normalizeChatId(value = '') {
  const clean = String(value).trim();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return `${clean.replace(/\D/g, '')}@c.us`;
}

function extractPhoneFromChatId(chatId = '') {
  return String(chatId).replace('@c.us', '').replace(/\D/g, '');
}

function getProviderError(error) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    'Unknown send failure'
  );
}

async function sendWhatsapp(chatId, messageText) {
  if (waConfig.provider === 'green_api') {
    const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
    if (!apiUrl || !idInstance || !apiTokenInstance) {
      throw new Error('Green API is not configured. Set GREEN_API_URL, GREEN_API_ID_INSTANCE, GREEN_API_TOKEN');
    }

    const response = await axios.post(
      `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
      { chatId, message: messageText },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data?.idMessage || response.data?.idMessageData || response.data?.messageData?.idMessage || null;
  }

  const { apiBase, phoneNumberId, accessToken } = waConfig.meta;
  if (!apiBase || !phoneNumberId || !accessToken) {
    throw new Error('Meta WhatsApp is not configured. Set META_WA_* environment variables.');
  }

  const response = await axios.post(
    `${apiBase}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: extractPhoneFromChatId(chatId),
      type: 'text',
      text: { body: messageText },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data?.messages?.[0]?.id || null;
}

function channelMatches(groupChannel, requestedChannel) {
  return groupChannel === requestedChannel || groupChannel === 'both';
}

function dedupeRecipients(members, channel) {
  const seen = new Set();
  const out = [];

  for (const member of members) {
    // For WhatsApp, defensively normalise legacy phones (members added before
    // the normaliser shipped may still be stored as "0712..." or "+254 712").
    const value = channel === 'email'
      ? String(member.email || '').trim().toLowerCase()
      : normalisePhone(member.phone);
    if (!value || seen.has(value)) continue;
    if (channel === 'email' && !EMAIL_RX.test(value)) continue;
    if (channel === 'whatsapp' && value.length < 8) continue;
    seen.add(value);
    out.push({
      recipient: value,
      name: member.name || '',
      member_id: member._id,
    });
  }

  return out;
}

async function writeAuditLog({ agentId, groupId, channel, total, sent, failed, results }) {
  const AuditModel = payservedb.BulkSendAudit || payservedb.BulkSendLog || payservedb.CustomerObsessionBulkSend;
  if (!AuditModel || typeof AuditModel.create !== 'function') return;

  await AuditModel.create({
    agent_id: agentId,
    group_id: groupId,
    channel,
    total,
    sent,
    failed,
    results,
    sent_at: new Date(),
  });
}

/**
 * POST /api/customer_obsession/bulk-send
 * body { group_id, channel: 'email'|'whatsapp', subject?, body }
 */
async function bulk_send(request, reply) {
  try {
    const { group_id, channel, subject, body } = request.body || {};
    const requestedChannel = String(channel || '').toLowerCase();
    const messageBody = String(body || '').trim();

    if (!group_id) return reply.code(400).send({ success: false, error: 'group_id is required' });
    if (!['email', 'whatsapp'].includes(requestedChannel)) {
      return reply.code(400).send({ success: false, error: 'channel must be email or whatsapp' });
    }
    if (!messageBody) return reply.code(400).send({ success: false, error: 'body is required' });
    if (requestedChannel === 'email' && !String(subject || '').trim()) {
      return reply.code(400).send({ success: false, error: 'subject is required for email bulk send' });
    }

    const group = await payservedb.RecipientGroup.findById(group_id).lean();
    if (!group) return reply.code(404).send({ success: false, error: 'Group not found' });
    if (!channelMatches(group.channel, requestedChannel)) {
      return reply.code(400).send({
        success: false,
        error: `Group channel '${group.channel}' cannot be used for ${requestedChannel}`,
      });
    }

    const members = await payservedb.RecipientGroupMember.find({ group_id })
      .select('name email phone')
      .lean();
    const recipients = dedupeRecipients(members, requestedChannel);
    if (recipients.length === 0) {
      return reply.code(400).send({ success: false, error: 'Group has no valid recipients for this channel' });
    }

    const cap = Number(process.env.CO_MAX_BULK_SEND_PER_REQUEST) || 500;
    if (recipients.length > cap) {
      return reply.code(400).send({
        success: false,
        error: `Bulk send recipient count ${recipients.length} exceeds the ${cap}-recipient cap`,
      });
    }

    const ccList = requestedChannel === 'email'
      ? mergeCcLists([], await getAlwaysCcAddresses(), emailConfig.smtp.auth.user)
      : [];

    const results = [];
    for (const item of recipients) {
      try {
        if (requestedChannel === 'email') {
          const info = await transporter.sendMail({
            from: emailConfig.smtp.auth.user,
            to: item.recipient,
            cc: ccList.length ? ccList : undefined,
            subject: String(subject).trim(),
            text: messageBody,
          });
          results.push({ recipient: item.recipient, success: true, message_id: info?.messageId || null });
        } else {
          const chatId = normalizeChatId(item.recipient);
          const providerMessageId = await sendWhatsapp(chatId, messageBody);
          await payservedb.WhatsappConversation.create({
            wa_message_id: providerMessageId,
            chat_id: chatId,
            contact_name: item.name || undefined,
            contact_phone: extractPhoneFromChatId(chatId),
            direction: 'outbound',
            message_text: messageBody,
            message_type: 'text',
            timestamp: new Date(),
            is_read: true,
            replied_by: request.user?.userId,
          });
          results.push({ recipient: item.recipient, success: true, message_id: providerMessageId });
        }
      } catch (error) {
        results.push({ recipient: item.recipient, success: false, error: getProviderError(error) });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.length - sent;

    try {
      await writeAuditLog({
        agentId: request.user?.userId,
        groupId: group_id,
        channel: requestedChannel,
        total: results.length,
        sent,
        failed,
        results,
      });
    } catch (error) {
      logger.warn(`bulk_send audit log failed: ${error.message}`);
    }

    return reply.code(200).send({
      success: true,
      data: {
        total: results.length,
        sent,
        failed,
        results,
      },
    });
  } catch (err) {
    logger.error('bulk_send error', err);
    return reply.code(500).send({ success: false, error: 'Bulk send failed', details: err.message });
  }
}

module.exports = bulk_send;
