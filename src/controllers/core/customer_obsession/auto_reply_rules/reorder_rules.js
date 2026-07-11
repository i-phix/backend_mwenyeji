const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * POST /api/core/customer_obsession/auto-reply-rules/reorder
 * body { ordered_ids: string[] }  // index 0 = highest priority
 */
async function reorder_rules(request, reply) {
  try {
    const { ordered_ids } = request.body || {};
    if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
      return reply.code(400).send({ success: false, error: 'ordered_ids is required' });
    }

    // Confirm all IDs exist before mutating
    const found = await payservedb.AutoReplyRule.find({ _id: { $in: ordered_ids } }).select('_id').lean();
    if (found.length !== ordered_ids.length) {
      return reply.code(400).send({
        success: false,
        error: 'One or more rule IDs do not exist',
      });
    }

    // Assign priorities by array index (0 = highest)
    const ops = ordered_ids.map((id, idx) => ({
      updateOne: { filter: { _id: id }, update: { priority: idx, updated_by: request.user?.userId } },
    }));
    await payservedb.AutoReplyRule.bulkWrite(ops);

    return reply.code(200).send({ success: true });
  } catch (err) {
    logger.error('reorder_rules error', err);
    return reply.code(500).send({ success: false, error: 'Failed to reorder rules' });
  }
}

module.exports = reorder_rules;
