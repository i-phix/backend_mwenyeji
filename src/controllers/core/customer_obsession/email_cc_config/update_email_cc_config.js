const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin: update an existing CC entry (toggle enabled or change address).
 * PUT /api/core/customer_obsession/email-cc-config/:id  body { enabled?, address? }
 */
async function update_email_cc_config(request, reply) {
  try {
    const { id } = request.params;
    const { enabled, address } = request.body || {};
    if (!id) return reply.code(400).send({ success: false, error: 'id is required' });

    const update = { updated_by: request.user?.userId };
    if (typeof enabled === 'boolean') update.enabled = enabled;
    if (typeof address === 'string') {
      const clean = address.trim().toLowerCase();
      if (!EMAIL_RX.test(clean)) {
        return reply.code(400).send({ success: false, error: 'Invalid email address' });
      }
      const duplicate = await payservedb.EmailCcConfig.findOne({ address: clean, _id: { $ne: id } });
      if (duplicate) {
        return reply.code(409).send({ success: false, error: 'That address is already configured' });
      }
      update.address = clean;
    }

    const row = await payservedb.EmailCcConfig.findByIdAndUpdate(id, update, { new: true });
    if (!row) return reply.code(404).send({ success: false, error: 'CC entry not found' });

    return reply.code(200).send({ success: true, data: row });
  } catch (err) {
    logger.error('update_email_cc_config error', err);
    return reply.code(500).send({ success: false, error: 'Failed to update CC entry' });
  }
}

module.exports = update_email_cc_config;
