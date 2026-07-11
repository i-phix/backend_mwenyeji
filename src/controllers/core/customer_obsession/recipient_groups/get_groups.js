const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * GET /api/core/customer_obsession/recipient-groups
 * Returns groups with member_count, audit columns, etc.
 */
async function get_groups(request, reply) {
  try {
    const groups = await payservedb.RecipientGroup
      .find({})
      .populate('created_by', 'fullName email')
      .sort({ created_at: -1 })
      .lean();
    return reply.code(200).send({ success: true, data: groups });
  } catch (err) {
    logger.error('get_groups error', err);
    return reply.code(500).send({ success: false, error: 'Failed to load groups' });
  }
}

module.exports = get_groups;
