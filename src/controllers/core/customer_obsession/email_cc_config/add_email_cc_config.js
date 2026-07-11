const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin: add a new always-CC address.
 * POST /api/core/customer_obsession/email-cc-config   body { address, enabled? }
 */
async function add_email_cc_config(request, reply) {
  try {
    const { address, enabled } = request.body || {};
    if (!address || typeof address !== 'string') {
      return reply.code(400).send({ success: false, error: 'address is required' });
    }
    const clean = address.trim().toLowerCase();
    if (!EMAIL_RX.test(clean)) {
      return reply.code(400).send({ success: false, error: 'Invalid email address' });
    }

    const duplicate = await payservedb.EmailCcConfig.findOne({ address: clean });
    if (duplicate) {
      return reply.code(409).send({ success: false, error: 'That address is already configured' });
    }

    const row = await payservedb.EmailCcConfig.create({
      address: clean,
      enabled: enabled !== false,
      added_by: request.user?.userId,
      updated_by: request.user?.userId,
    });

    return reply.code(200).send({ success: true, data: row });
  } catch (err) {
    logger.error('add_email_cc_config error', err);
    return reply.code(500).send({ success: false, error: 'Failed to add CC address' });
  }
}

module.exports = add_email_cc_config;
