const db = require('payservedb');
const logger = require('../../../../config/winston');
const { sendEmail } = require('../../../utils/send_new_email');
const { sendSms } = require('../../../utils/send_new_sms');

const CALL_CENTER_NUMBER = '+254733902550';

const clean = (value) => String(value || '').trim();

const targetList = (target) => {
    if (target === 'tenant') return ['tenant'];
    if (target === 'landlord') return ['landlord'];
    return ['tenant', 'landlord'];
};

function appendCallCenter(message) {
    const base = clean(message);
    if (base.includes(CALL_CENTER_NUMBER)) return base;
    return `${base}\n\nFor help, call Move-In support on ${CALL_CENTER_NUMBER}.`;
}

async function sendMoveInReminder({
    relatedType,
    related,
    target = 'both',
    channels = ['email'],
    subject = 'Move-In reminder',
    message,
    actorId = null,
    actorType = 'admin',
}) {
    if (!relatedType || !related?._id) throw new Error('relatedType and related record are required.');
    const finalMessage = appendCallCenter(message || `Reminder for ${related.unitName || 'your Move-In request'}.`);
    const targets = targetList(target);
    const uniqueChannels = [...new Set((channels || ['email']).filter(Boolean))];
    const results = [];

    const reminderData = {
        relatedType,
        relatedId: related._id,
        unitId: related.unitId || null,
        unitName: related.unitName || null,
        facilityId: related.facilityId || null,
        facilityName: related.facilityName || null,
        landlordId: related.landlordId || null,
        landlordName: related.landlordName || null,
        landlordEmail: related.landlordEmail || null,
        landlordPhone: related.landlordPhone || null,
        tenantId: related.tenantId || null,
        tenantName: related.tenantName || null,
        tenantEmail: related.tenantEmail || null,
        tenantPhone: related.tenantPhone || null,
        target,
        channels: uniqueChannels,
        subject,
        message: finalMessage,
        callCenterNumber: CALL_CENTER_NUMBER,
        createdBy: actorId,
        createdByType: actorType,
    };

    for (const recipientTarget of targets) {
        const email = clean(related[`${recipientTarget}Email`]).toLowerCase();
        const phone = clean(related[`${recipientTarget}Phone`]);

        for (const channel of uniqueChannels) {
            const result = {
                channel,
                target: recipientTarget,
                recipient: channel === 'email' ? email : phone,
                success: false,
                method: null,
                error: null,
                sentAt: null,
            };

            try {
                if (channel === 'email') {
                    if (!email) throw new Error(`${recipientTarget} email is missing.`);
                    const sent = await sendEmail(related.facilityId || null, email, subject, finalMessage, null, 'Move-In by PayServe');
                    result.success = true;
                    result.method = sent?.method || 'email';
                    result.sentAt = new Date();
                } else if (channel === 'sms') {
                    if (!phone) throw new Error(`${recipientTarget} phone is missing.`);
                    const sent = await sendSms(related.facilityId || null, phone, finalMessage);
                    result.success = true;
                    result.method = sent?.method || 'sms';
                    result.sentAt = new Date();
                } else if (channel === 'whatsapp') {
                    result.error = 'WhatsApp provider is not configured for Move-In yet.';
                }
            } catch (err) {
                result.error = err.message;
                logger.warn(`[move_in/reminders] ${channel} reminder failed for ${recipientTarget}: ${err.message}`);
            }

            results.push(result);
        }
    }

    const successCount = results.filter((result) => result.success).length;
    const status = successCount === results.length && results.length
        ? 'sent'
        : successCount > 0
            ? 'partial'
            : 'failed';

    const reminder = await db.moveIn.MoveInReminder.create({
        ...reminderData,
        results,
        status,
        sentAt: successCount > 0 ? new Date() : null,
    });

    return reminder;
}

module.exports = {
    CALL_CENTER_NUMBER,
    appendCallCenter,
    sendMoveInReminder,
};
