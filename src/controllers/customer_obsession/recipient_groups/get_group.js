const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

/**
 * GET /api/customer_obsession/recipient-groups/:id
 * Agent view: group + members (no audit columns).
 */
async function get_group(request, reply) {
  try {
    const { id } = request.params;
    const group = await payservedb.RecipientGroup
      .findById(id)
      .select('name channel description member_count')
      .lean();
    if (!group) return reply.code(404).send({ success: false, error: 'Group not found' });

    const members = await payservedb.RecipientGroupMember
      .find({ group_id: id })
      .select('name email phone customer_id')
      .sort({ added_at: 1 })
      .lean();

    return reply.code(200).send({ success: true, data: { ...group, members } });
  } catch (err) {
    logger.error('get_group (agent) error', err);
    return reply.code(500).send({ success: false, error: 'Failed to load group' });
  }
}

module.exports = get_group;
