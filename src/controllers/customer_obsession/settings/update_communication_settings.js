const CommunicationSettings = require('../../../models/communication_settings');
const logger = require('../../../../config/winston');

// PUT /api/customer_obsession/settings/communication/:channel
// channel: 'email' or 'whatsapp'
async function update_communication_settings(request, reply) {
    try {
        const { channel } = request.params;
        if (!['email', 'whatsapp'].includes(channel)) {
            return reply.code(400).send({ success: false, error: 'channel must be email or whatsapp' });
        }

        const { auto_reply_enabled, auto_reply_message, delay_auto_reply_enabled, delay_minutes, delay_auto_reply_message } = request.body;

        const update = {};
        if (typeof auto_reply_enabled === 'boolean') update.auto_reply_enabled = auto_reply_enabled;
        if (typeof auto_reply_message === 'string') update.auto_reply_message = auto_reply_message.trim();
        if (typeof delay_auto_reply_enabled === 'boolean') update.delay_auto_reply_enabled = delay_auto_reply_enabled;
        if (typeof delay_minutes === 'number' && delay_minutes >= 1) update.delay_minutes = delay_minutes;
        if (typeof delay_auto_reply_message === 'string') update.delay_auto_reply_message = delay_auto_reply_message.trim();

        const settings = await CommunicationSettings.findOneAndUpdate(
            { channel },
            { $set: update },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        logger.info(`[settings] ${channel} auto-reply updated by agent ${request.user?.userId}`);

        return reply.code(200).send({ success: true, data: settings });
    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = update_communication_settings;
