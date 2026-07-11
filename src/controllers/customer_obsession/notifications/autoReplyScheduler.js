const cron = require('node-cron');
const payservedb = require('payservedb');
const EmailThread = require('../../../models/email_thread');
const CommunicationSettings = require('../../../models/communication_settings');
const { sendEmail } = require('../../../utils/send_new_email');
const waConfig = require('../../../config/whatsapp');
const axios = require('axios');
const logger = require('../../../../config/winston');

// ── WhatsApp sender ───────────────────────────────────────────────────────────

async function sendWaAutoReply(chatId, message) {
    if (waConfig.provider === 'green_api') {
        const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
        if (!apiUrl || !idInstance || !apiTokenInstance) throw new Error('Green API not configured');
        await axios.post(
            `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
            { chatId, message },
            { headers: { 'Content-Type': 'application/json' } }
        );
    } else {
        const phone = String(chatId).replace('@c.us', '').replace(/\D/g, '');
        const { apiBase, phoneNumberId, accessToken } = waConfig.meta;
        if (!apiBase || !phoneNumberId || !accessToken) throw new Error('Meta WA not configured');
        await axios.post(
            `${apiBase}/${phoneNumberId}/messages`,
            { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } },
            { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );
    }
}

// ── Core check functions ──────────────────────────────────────────────────────

async function checkDelayedEmailReplies(settings) {
    if (!settings.delay_auto_reply_enabled) return { sent: 0 };

    const cutoff = new Date(Date.now() - settings.delay_minutes * 60 * 1000);

    // Find INBOX emails that are unreplied, not auto-replied, and older than threshold
    const emails = await EmailThread.find({
        folder: { $in: ['INBOX', 'inbox'] },
        is_replied: false,
        auto_replied_at: null,
        date: { $lt: cutoff }
    }).limit(50).lean();

    let sent = 0;
    for (const email of emails) {
        const replyTo = email.from_email;
        if (!replyTo) continue;

        try {
            await sendEmail(
                null, // no specific facilityId — uses global defaults
                replyTo,
                `Re: ${email.subject || 'Your enquiry'}`,
                settings.delay_auto_reply_message,
                null,
                'PayServe Support'
            );

            // Mark as auto-replied so we don't send again
            await EmailThread.findByIdAndUpdate(email._id, { auto_replied_at: new Date() });

            // Save outbound record so inbox shows the auto-reply
            await EmailThread.create({
                thread_id: email.thread_id,
                from_email: email.mailbox_account || email.to_email,
                to_email: replyTo,
                subject: `Re: ${email.subject || 'Your enquiry'}`,
                body_text: settings.delay_auto_reply_message,
                in_reply_to: email.message_id,
                date: new Date(),
                is_read: true,
                is_replied: true,
                folder: 'SENT',
                mailbox_account: email.mailbox_account
            });

            sent++;
            logger.info(`[auto-reply] Delay email auto-reply sent to ${replyTo} for email ${email._id}`);
        } catch (err) {
            logger.error(`[auto-reply] Failed to send delay email auto-reply to ${replyTo}: ${err.message}`);
        }
    }

    return { sent };
}

async function checkDelayedWaReplies(settings) {
    if (!settings.delay_auto_reply_enabled) return { sent: 0 };

    const cutoff = new Date(Date.now() - settings.delay_minutes * 60 * 1000);

    // Find all chat_ids whose latest inbound message is older than cutoff
    const candidates = await payservedb.WhatsappConversation.aggregate([
        {
            $sort: { chat_id: 1, timestamp: -1 }
        },
        {
            $group: {
                _id: '$chat_id',
                lastDirection: { $first: '$direction' },
                lastTimestamp: { $first: '$timestamp' },
                lastMessageId: { $first: '$_id' },
                contactName: { $first: '$contact_name' },
                contactPhone: { $first: '$contact_phone' }
            }
        },
        {
            $match: {
                lastDirection: 'inbound',
                lastTimestamp: { $lt: cutoff }
            }
        }
    ]);

    let sent = 0;
    for (const chat of candidates) {
        const chatId = chat._id;
        try {
            await sendWaAutoReply(chatId, settings.delay_auto_reply_message);

            // Record the outbound auto-reply so next cron iteration sees an outbound as the latest
            await payservedb.WhatsappConversation.create({
                chat_id: chatId,
                contact_name: chat.contactName,
                contact_phone: chat.contactPhone,
                direction: 'outbound',
                message_text: settings.delay_auto_reply_message,
                message_type: 'text',
                timestamp: new Date(),
                is_read: true
            });

            sent++;
            logger.info(`[auto-reply] Delay WA auto-reply sent to chat ${chatId}`);
        } catch (err) {
            logger.error(`[auto-reply] Failed to send delay WA auto-reply to ${chatId}: ${err.message}`);
        }
    }

    return { sent };
}

async function runAutoReplyCheck() {
    try {
        const [emailSettings, waSettings] = await Promise.all([
            CommunicationSettings.findOne({ channel: 'email' }).lean(),
            CommunicationSettings.findOne({ channel: 'whatsapp' }).lean()
        ]);

        const defaults = {
            delay_auto_reply_enabled: false,
            delay_minutes: 30,
            delay_auto_reply_message: 'We apologise for the delay. Our team is still working on your enquiry and will get back to you as soon as possible. Thank you for your patience.'
        };

        const emailCfg = { ...defaults, ...(emailSettings || {}) };
        const waCfg = { ...defaults, ...(waSettings || {}) };

        const [emailResult, waResult] = await Promise.all([
            checkDelayedEmailReplies(emailCfg),
            checkDelayedWaReplies(waCfg)
        ]);

        return { emails_sent: emailResult.sent, wa_sent: waResult.sent };
    } catch (err) {
        logger.error(`[auto-reply] Error in auto-reply check: ${err.message}`);
        throw err;
    }
}

// ── Scheduler class ───────────────────────────────────────────────────────────

class AutoReplyScheduler {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
    }

    // Runs every 5 minutes by default
    startCron(cronExpression = '*/5 * * * *') {
        if (this.cronJob) {
            logger.warn('[auto-reply] Scheduler already running');
            return;
        }

        this.cronJob = cron.schedule(cronExpression, async () => {
            if (this.isRunning) return;
            this.isRunning = true;
            try {
                const result = await runAutoReplyCheck();
                if (result.emails_sent > 0 || result.wa_sent > 0) {
                    logger.info(`[auto-reply] Sent ${result.emails_sent} email(s) and ${result.wa_sent} WhatsApp message(s)`);
                }
            } catch (err) {
                logger.error(`[auto-reply] Scheduler error: ${err.message}`);
            } finally {
                this.isRunning = false;
            }
        });

        logger.info(`[auto-reply] Scheduler started (${cronExpression})`);
    }

    stopCron() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger.info('[auto-reply] Scheduler stopped');
        }
    }

    async runNow() {
        if (this.isRunning) return { success: false, message: 'Already running' };
        this.isRunning = true;
        try {
            const result = await runAutoReplyCheck();
            return { success: true, ...result };
        } finally {
            this.isRunning = false;
        }
    }
}

const autoReplyScheduler = new AutoReplyScheduler();
module.exports = autoReplyScheduler;
