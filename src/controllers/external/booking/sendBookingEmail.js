const nodemailer = require('nodemailer');
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * Send booking email with PDF attachment using nodemailer
 * @param {string} facilityId - Facility ID
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML email body
 * @param {Array} attachments - Array of attachments
 */
async function sendBookingEmail(facilityId, to, subject, html, attachments = []) {
    try {
        console.log(`Sending booking email to ${to} for facility ${facilityId}`);

        // Fetch email settings for the facility
        let emailSettings;
        try {
            const response = await axios.get(
                `${BACKEND_URL}/api/app/settings_management/get_email_settings/${facilityId}`,
                { timeout: 10000 }
            );

            if (response.data && response.data.success && response.data.data) {
                emailSettings = response.data.data;
                console.log('Using facility email settings');
            } else {
                throw new Error('No email settings found for facility');
            }
        } catch (error) {
            console.log('Failed to fetch facility email settings, using defaults');
            // Fallback to default email settings
            emailSettings = {
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.EMAIL_PORT) || 587,
                secure: false,
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
                sender: process.env.EMAIL_SENDER || process.env.EMAIL_USER,
                senderName: process.env.EMAIL_SENDER_NAME || 'Payserve Booking'
            };
        }

        // Validate email settings
        if (!emailSettings.host || !emailSettings.user || !emailSettings.pass) {
            throw new Error('Incomplete email configuration');
        }

        // Create transporter
        const transporter = nodemailer.createTransport({
            host: emailSettings.host,
            port: parseInt(emailSettings.port) || 587,
            secure: emailSettings.secure === 'true' || emailSettings.secure === true,
            auth: {
                user: emailSettings.user,
                pass: emailSettings.pass
            },
            tls: {
                rejectUnauthorized: emailSettings.rejectUnauthorized !== 'false'
            }
        });

        // Email options
        const senderName = emailSettings.senderName || 'Payserve Booking';
        const senderEmail = emailSettings.sender || emailSettings.user;
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: to,
            subject: subject,
            html: html,
            attachments: attachments
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Email sent successfully to ${to}. Message ID: ${info.messageId}`);

        return {
            success: true,
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected
        };

    } catch (error) {
        console.error(`❌ Failed to send booking email to ${to}:`, error.message);
        throw error;
    }
}

module.exports = { sendBookingEmail };
