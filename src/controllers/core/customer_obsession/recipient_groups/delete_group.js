const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * DELETE /api/core/customer_obsession/recipient-groups/:id
 * Deletes the group AND all its members in one shot.
 */
async function delete_group(request, reply) {
  try {
    const { id } = request.params;
    if (!id) return reply.code(400).send({ success: false, error: 'id is required' });

    const group = await payservedb.RecipientGroup.findByIdAndDelete(id);
    if (!group) return reply.code(404).send({ success: false, error: 'Group not found' });

    await payservedb.RecipientGroupMember.deleteMany({ group_id: id });

    return reply.code(200).send({ success: true });
  } catch (err) {
    logger.error('delete_group error', err);
    return reply.code(500).send({ success: false, error: 'Failed to delete group' });
  }
}

module.exports = delete_group;
