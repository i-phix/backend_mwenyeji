const CommunicationSettings = require('../../../models/communication_settings');

// GET /api/customer_obsession/settings/communication
// Returns auto-reply settings for email and whatsapp channels
async function get_communication_settings(request, reply) {
    try {
        const [emailSettings, waSettings] = await Promise.all([
            CommunicationSettings.findOne({ channel: 'email' }).lean(),
            CommunicationSettings.findOne({ channel: 'whatsapp' }).lean(),
        ]);

        const defaults = {
            auto_reply_enabled: true,
            auto_reply_message: 'Thank you for contacting PayServe Support. We have received your message and will respond shortly.',
            delay_auto_reply_enabled: false,
            delay_minutes: 30,
            delay_auto_reply_message: 'We apologise for the delay. Our team is still working on your enquiry and will get back to you as soon as possible. Thank you for your patience.',
        };

        return reply.code(200).send({
            success: true,
            data: {
                email: emailSettings || { channel: 'email', ...defaults },
                whatsapp: waSettings || { channel: 'whatsapp', ...defaults },
            },
        });
    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = get_communication_settings;
