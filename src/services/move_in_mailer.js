const nodemailer = require('nodemailer');
const logger = require('../../config/winston');

const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const FROM = `"${process.env.EMAIL_SENDER_NAME || 'Payserve Move-In'}" <${process.env.EMAIL_SENDER}>`;

async function sendMail({ to, subject, html, text }) {
    try {
        await transporter.sendMail({ from: FROM, to, subject, html, text });
        logger.info(`[move_in_mailer] Email sent to ${to}: "${subject}"`);
    } catch (err) {
        logger.error(`[move_in_mailer] Failed to send to ${to}: ${err.message}`);
    }
}

// ── Notification helpers ───────────────────────────────────────────────────

function unitApproved(email, unitTitle) {
    return sendMail({
        to: email,
        subject: `Your unit has been approved — ${unitTitle}`,
        html: `<p>Hi,</p><p>Your unit <strong>${unitTitle}</strong> has been approved and is now live on the Move-In platform.</p><p>— Payserve Move-In</p>`,
    });
}

function unitRejected(email, unitTitle, note) {
    return sendMail({
        to: email,
        subject: `Your unit listing requires updates — ${unitTitle}`,
        html: `<p>Hi,</p><p>Your unit <strong>${unitTitle}</strong> could not be approved at this time.</p>${note ? `<p>Reason: ${note}</p>` : ''}<p>Please update your listing and resubmit.</p><p>— Payserve Move-In</p>`,
    });
}

function applicationScreened(tenantEmail, unitName) {
    return sendMail({
        to: tenantEmail,
        subject: `Your application has been reviewed — ${unitName}`,
        html: `<p>Hi,</p><p>Your application for <strong>${unitName}</strong> has passed initial screening and has been forwarded to the landlord for review. You'll hear back soon.</p><p>— Payserve Move-In</p>`,
    });
}

function applicationRejected(tenantEmail, unitName, note) {
    return sendMail({
        to: tenantEmail,
        subject: `Application update — ${unitName}`,
        html: `<p>Hi,</p><p>Unfortunately your application for <strong>${unitName}</strong> was not successful at this time.</p>${note ? `<p>Note: ${note}</p>` : ''}<p>— Payserve Move-In</p>`,
    });
}

function reservationConfirmed(tenantEmail, unitName, moveInDate) {
    return sendMail({
        to: tenantEmail,
        subject: `Move-In confirmed — ${unitName}`,
        html: `<p>Hi,</p><p>Congratulations! Your move-in to <strong>${unitName}</strong> has been confirmed${moveInDate ? ` for ${new Date(moveInDate).toLocaleDateString()}` : ''}.</p><p>Your resident account will be set up shortly.</p><p>— Payserve Move-In</p>`,
    });
}

function landlordVerified(email, fullName) {
    return sendMail({
        to: email,
        subject: 'Your landlord account has been verified',
        html: `<p>Hi ${fullName},</p><p>Your Move-In landlord account has been verified. You can now list units on the platform.</p><p>— Payserve Move-In</p>`,
    });
}

module.exports = {
    unitApproved,
    unitRejected,
    applicationScreened,
    applicationRejected,
    reservationConfirmed,
    landlordVerified,
};
