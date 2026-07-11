const { pullGreenNotifications } = require('./sync_notifications');
const logger = require('../../../../config/winston');

// POST /api/customer_obsession/whatsapp/sync
// Manually triggers a Green API notification pull (up to 50 items)
async function sync_messages(request, reply) {
  try {
    await pullGreenNotifications(50, true);
    logger.info('[wa-sync] Manual WhatsApp sync triggered');
    return reply.code(200).send({ success: true, message: 'WhatsApp messages synced' });
  } catch (error) {
    logger.error(`[wa-sync] ${error.message}`);
    return reply.code(500).send({ success: false, error: error.message });
  }
}

module.exports = sync_messages;
