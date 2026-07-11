const mongoose = require('mongoose');

// Stores per-channel communication settings (auto-reply, etc.)
// One document per channel: 'email' and 'whatsapp'
const communicationSettingsSchema = new mongoose.Schema(
    {
        channel: {
            type: String,
            enum: ['email', 'whatsapp'],
            required: true,
            unique: true,
        },
        // Immediate auto-reply when a message arrives
        auto_reply_enabled: { type: Boolean, default: true },
        auto_reply_message: {
            type: String,
            default: 'Thank you for contacting PayServe Support. We have received your message and will respond shortly.',
        },
        // Delayed auto-reply when no agent has responded after N minutes
        delay_auto_reply_enabled: { type: Boolean, default: false },
        delay_minutes: { type: Number, default: 30, min: 1 },
        delay_auto_reply_message: {
            type: String,
            default: 'We apologise for the delay. Our team is still working on your enquiry and will get back to you as soon as possible. Thank you for your patience.',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CommunicationSettings', communicationSettingsSchema);
