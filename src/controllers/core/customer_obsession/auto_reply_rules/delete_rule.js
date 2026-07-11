const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/** DELETE /api/core/customer_obsession/auto-reply-rules/:id */
async function delete_rule(request, reply) {
  try {
    const { id } = request.params;
    if (!id) return reply.code(400).send({ success: false, error: 'id is required' });
    const row = await payservedb.AutoReplyRule.findByIdAndDelete(id);
    if (!row) return reply.code(404).send({ success: false, error: 'Rule not found' });
    return reply.code(200).send({ success: true });
  } catch (err) {
    logger.error('delete_rule error', err);
    return reply.code(500).send({ success: false, error: 'Failed to delete rule' });
  }
}

module.exports = delete_rule;
