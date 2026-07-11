const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/** DELETE /api/core/customer_obsession/recipient-groups/:groupId/members/:memberId */
async function delete_member(request, reply) {
  try {
    const { groupId, memberId } = request.params;
    if (!groupId || !memberId) {
      return reply.code(400).send({ success: false, error: 'groupId and memberId are required' });
    }

    const member = await payservedb.RecipientGroupMember.findOneAndDelete({
      _id: memberId,
      group_id: groupId,
    });
    if (!member) return reply.code(404).send({ success: false, error: 'Member not found' });

    // Decrement denormalised count
    await payservedb.RecipientGroup.findByIdAndUpdate(groupId, {
      $inc: { member_count: -1 },
      updated_by: request.user?.userId,
    });

    return reply.code(200).send({ success: true });
  } catch (err) {
    logger.error('delete_member error', err);
    return reply.code(500).send({ success: false, error: 'Failed to remove member' });
  }
}

module.exports = delete_member;
