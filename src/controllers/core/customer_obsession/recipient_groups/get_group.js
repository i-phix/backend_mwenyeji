const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * GET /api/core/customer_obsession/recipient-groups/:id
 * Returns the group + its members.
 */
async function get_group(request, reply) {
  try {
    const { id } = request.params;
    const group = await payservedb.RecipientGroup.findById(id).lean();
    if (!group) return reply.code(404).send({ success: false, error: 'Group not found' });

    const members = await payservedb.RecipientGroupMember
      .find({ group_id: id })
      .sort({ added_at: 1 })
      .lean();

    return reply.code(200).send({ success: true, data: { ...group, members } });
  } catch (err) {
    logger.error('get_group error', err);
    return reply.code(500).send({ success: false, error: 'Failed to load group' });
  }
}

module.exports = get_group;
