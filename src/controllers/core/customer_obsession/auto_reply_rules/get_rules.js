const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/** GET /api/core/customer_obsession/auto-reply-rules */
async function get_rules(request, reply) {
  try {
    const rules = await payservedb.AutoReplyRule
      .find({})
      .sort({ priority: 1, created_at: 1 })
      .lean();
    return reply.code(200).send({ success: true, data: rules });
  } catch (err) {
    logger.error('get_rules error', err);
    return reply.code(500).send({ success: false, error: 'Failed to load rules' });
  }
}

module.exports = get_rules;
