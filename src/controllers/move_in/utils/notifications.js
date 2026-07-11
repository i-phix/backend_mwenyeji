const db = require('payservedb');
const { sendEmail } = require('../../../utils/send_new_email');
const logger = require('../../../../config/winston');

const clean = (value) => String(value || '').trim();

const adminEmails = () => clean(process.env.MOVE_IN_ADMIN_EMAILS || process.env.MOVEIN_ADMIN_EMAILS)
    .split(',')
    .map((email) => clean(email).toLowerCase())
    .filter(Boolean);

const notifyInApp = async ({
    recipientId = null,
    recipientEmail = null,
    recipientType,
    title,
    body,
    type = 'general',
    relatedId = null,
    metadata = {},
}) => {
    if (!recipientType || !title || !body) return null;
    if (!recipientId && recipientType !== 'guest') return null;

    try {
        return await db.moveIn.MoveInNotification.create({
            recipientId,
            recipientEmail: recipientEmail ? clean(recipientEmail).toLowerCase() : null,
            recipientType,
            title,
            body,
            type,
            relatedId,
            metadata,
        });
    } catch (err) {
        logger.warn(`[move_in/notifications] in-app skipped: ${err.message}`);
        return null;
    }
};

const notifyEmail = async ({
    to,
    subject,
    text,
    html = null,
    facilityId = null,
    senderName = 'Move-In by PayServe',
}) => {
    const recipient = clean(to).toLowerCase();
    if (!recipient) return null;

    try {
        return await sendEmail(facilityId || null, recipient, subject, text, html, senderName);
    } catch (err) {
        logger.warn(`[move_in/notifications] email skipped for ${recipient}: ${err.message}`);
        return null;
    }
};

const notifyTenant = async ({
    tenantId,
    email,
    title,
    body,
    type = 'general',
    relatedId = null,
    metadata = {},
    emailSubject,
    emailText,
    facilityId = null,
}) => {
    if (tenantId) {
        await notifyInApp({ recipientId: tenantId, recipientEmail: email, recipientType: 'tenant', title, body, type, relatedId, metadata });
    }
    if (email && emailSubject) {
        await notifyEmail({ to: email, subject: emailSubject, text: emailText || body, facilityId });
    }
};

const notifyLandlord = async ({
    landlordId,
    email,
    title,
    body,
    type = 'general',
    relatedId = null,
    metadata = {},
    emailSubject,
    emailText,
    facilityId = null,
}) => {
    let recipientEmail = email;
    if (!recipientEmail && landlordId) {
        const landlordModel = db.moveIn?.MoveInLandlordUser;
        const landlord = landlordModel
            ? await landlordModel.findById(landlordId).select('email').lean().catch(() => null)
            : null;
        recipientEmail = landlord?.email || null;
    }

    if (landlordId) {
        await notifyInApp({ recipientId: landlordId, recipientEmail, recipientType: 'landlord', title, body, type, relatedId, metadata });
    }
    if (recipientEmail && emailSubject) {
        await notifyEmail({ to: recipientEmail, subject: emailSubject, text: emailText || body, facilityId });
    }
};

const notifyConfiguredAdmins = async ({ subject, text, html = null, facilityId = null }) => {
    const recipients = adminEmails();
    await Promise.all(recipients.map((to) => notifyEmail({ to, subject, text, html, facilityId })));
};

module.exports = {
    notifyInApp,
    notifyEmail,
    notifyTenant,
    notifyLandlord,
    notifyConfiguredAdmins,
    adminEmails,
};
