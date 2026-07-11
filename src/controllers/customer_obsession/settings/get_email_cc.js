const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

/**
 * Agent: read-only list of enabled CC addresses. Used to render the
 * "Always CC" chips on the email composer. No audit metadata returned.
 * GET /api/customer_obsession/settings/email-cc
 */
async function get_email_cc(request, reply) {
  try {
    const rows = await payservedb.EmailCcConfig
      .find({ enabled: true })
      .select('address enabled')
      .sort({ created_at: 1 })
      .lean();
    return reply.code(200).send({ success: true, data: rows });
  } catch (err) {
    logger.error('get_email_cc (agent) error', err);
    return reply.code(500).send({ success: false, error: 'Failed to load CC list' });
  }
}

module.exports = get_email_cc;
