const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * Admin: list every CC address (enabled + disabled) with audit metadata.
 * GET /api/core/customer_obsession/email-cc-config
 */
async function get_email_cc_configs(request, reply) {
  try {
    const rows = await payservedb.EmailCcConfig
      .find({})
      .populate('added_by', 'fullName email')
      .populate('updated_by', 'fullName email')
      .sort({ created_at: -1 })
      .lean();
    return reply.code(200).send({ success: true, data: rows });
  } catch (err) {
    logger.error('get_email_cc_configs error', err);
    return reply.code(500).send({ success: false, error: 'Failed to load CC config' });
  }
}

module.exports = get_email_cc_configs;
