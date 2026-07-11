const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * Admin: remove a CC address permanently.
 * DELETE /api/core/customer_obsession/email-cc-config/:id
 */
async function delete_email_cc_config(request, reply) {
  try {
    const { id } = request.params;
    if (!id) return reply.code(400).send({ success: false, error: 'id is required' });

    const row = await payservedb.EmailCcConfig.findByIdAndDelete(id);
    if (!row) return reply.code(404).send({ success: false, error: 'CC entry not found' });

    return reply.code(200).send({ success: true });
  } catch (err) {
    logger.error('delete_email_cc_config error', err);
    return reply.code(500).send({ success: false, error: 'Failed to delete CC entry' });
  }
}

module.exports = delete_email_cc_config;
