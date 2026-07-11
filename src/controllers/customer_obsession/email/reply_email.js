const nodemailer = require('nodemailer');
const payservedb = require('payservedb');
const EmailThread = require('../../../models/email_thread');
const emailConfig = require('../../../config/email');
const { getAlwaysCcAddresses, mergeCcLists } = require('../../../utils/email_cc');

const transporter = nodemailer.createTransport(emailConfig.smtp);

function parseEmails(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function pickReplyRecipient(emailThread, mailboxEmail) {
  const mailbox = String(mailboxEmail || '').toLowerCase();
  const folder = String(emailThread?.folder || '').toUpperCase();
  const from = String(emailThread?.from_email || '').trim();
  const toList = parseEmails(emailThread?.to_email);

  if (folder === 'SENT' || String(from).toLowerCase() === mailbox) {
    const external = toList.find((email) => String(email).toLowerCase() !== mailbox);
    return external || toList[0] || '';
  }

  if (from && String(from).toLowerCase() !== mailbox) {
    return from;
  }

  const fallback = toList.find((email) => String(email).toLowerCase() !== mailbox);
  return fallback || '';
}

async function reply_email(request, reply) {
  try {
    const mailboxAccount = String(emailConfig.imap.user || '').trim().toLowerCase();
    const { email_id } = request.params;
    const { reply_text, reply_html, cc } = request.body;

    if (!reply_text && !reply_html) {
      return reply.code(400).send({
        success: false,
        error: 'reply_text or reply_html is required'
      });
    }

    const emailThread = await EmailThread.findOne({
      _id: email_id,
      mailbox_account: mailboxAccount
    }).lean();
    if (!emailThread) {
      return reply.code(404).send({
        success: false,
        error: 'Email thread not found'
      });
    }

    // Always-CC list comes from the admin-managed EmailCcConfig collection,
    // with env fallback (CO_EMAIL_PERMANENT_CC) preserved for deployments
    // that haven't seeded admin rows yet. See utils/email_cc.js.
    const PERMANENT_CC = await getAlwaysCcAddresses();

    const userCc = Array.isArray(cc)
      ? cc.map((v) => String(v).trim()).filter(Boolean)
      : String(cc || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);

    const ccList = mergeCcLists(userCc, PERMANENT_CC, emailConfig.smtp.auth.user);

    const baseSubject = emailThread.subject || 'Support Request';
    const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;
    const threadId = emailThread.thread_id || emailThread.message_id || `thread-${Date.now()}`;
    const references = [emailThread.references, emailThread.message_id].filter(Boolean).join(' ').trim();
    const replyTo = pickReplyRecipient(emailThread, emailConfig.smtp.auth.user);

    if (!replyTo) {
      return reply.code(400).send({
        success: false,
        error: 'No valid recipient found for this thread'
      });
    }

    const sendInfo = await transporter.sendMail({
      from: emailConfig.smtp.auth.user,
      to: replyTo,
      cc: ccList.length ? ccList : undefined,
      subject,
      text: reply_text,
      html: reply_html,
      inReplyTo: emailThread.message_id || undefined,
      references: references || undefined
    });

    const updated = await EmailThread.findByIdAndUpdate(
      email_id,
      {
        is_replied: true,
        replied_at: new Date(),
        replied_by: request.user.userId,
        reply_text: reply_text || '',
        thread_id: threadId
      },
      { new: true }
    ).lean();

    const outgoingMessageId = sendInfo?.messageId || `sent-${Date.now()}`;
    await EmailThread.findOneAndUpdate(
      { message_id: outgoingMessageId },
      {
        $set: {
          message_id: outgoingMessageId,
          thread_id: threadId,
          in_reply_to: emailThread.message_id || '',
          references: references || '',
          from_email: emailConfig.smtp.auth.user,
          from_name: emailConfig.smtp.auth.user,
          to_email: replyTo,
          cc_email: ccList.join(', '),
          subject,
          body_text: reply_text || '',
          body_html: reply_html || '',
          date: new Date(),
          folder: 'SENT',
          mailbox_account: mailboxAccount,
          is_read: true,
          is_replied: false,
          created_at: new Date(),
          linked_ticket_id: updated?.linked_ticket_id || null,
          linked_by: updated?.linked_by || null,
          linked_at: updated?.linked_at || null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (updated?.linked_ticket_id) {
      await payservedb.CustomerTicket.findByIdAndUpdate(updated.linked_ticket_id, {
        $push: {
          interactions: {
            agent_id: request.user.userId,
            message: `Email reply sent to ${updated.from_email}`,
            is_internal_note: true,
            created_at: new Date()
          }
        }
      });
    }

    return reply.code(200).send({
      success: true,
      message: 'Email reply sent successfully',
      data: updated
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to send email reply',
      details: error.message
    });
  }
}

module.exports = reply_email;
