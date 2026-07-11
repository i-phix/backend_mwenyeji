const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * PUT /api/core/customer_obsession/auto-reply-rules/:id
 * body { channel?, keyword?, reply?, enabled?, priority? }
 */
async function update_rule(request, reply) {
  try {
    const { id } = request.params;
    if (!id) return reply.code(400).send({ success: false, error: 'id is required' });

    const { channel, keyword, reply: replyText, enabled, priority } = request.body || {};
    const update = { updated_by: request.user?.userId };

    if (channel !== undefined) {
      if (!['email', 'whatsapp'].includes(channel)) {
        return reply.code(400).send({ success: false, error: 'channel must be email or whatsapp' });
      }
      update.channel = channel;
    }
    if (keyword !== undefined) {
      if (typeof keyword !== 'string' || !keyword.trim()) {
        return reply.code(400).send({ success: false, error: 'keyword cannot be empty' });
      }
      if (/\s/.test(keyword.trim())) {
        return reply.code(400).send({ success: false, error: 'keyword must be a single word' });
      }
      update.keyword = keyword.trim();
    }
    if (replyText !== undefined) {
      if (typeof replyText !== 'string' || !replyText.trim()) {
        return reply.code(400).send({ success: false, error: 'reply cannot be empty' });
      }
      if (replyText.length > 1000) {
        return reply.code(400).send({ success: false, error: 'reply must be 1000 characters or less' });
      }
      update.reply = replyText.trim();
    }
    if (typeof enabled === 'boolean') update.enabled = enabled;
    if (priority !== undefined && Number.isFinite(Number(priority))) update.priority = Number(priority);

    // Duplicate guard if channel or keyword changed
    if (update.channel || update.keyword) {
      const current = await payservedb.AutoReplyRule.findById(id).lean();
      if (!current) return reply.code(404).send({ success: false, error: 'Rule not found' });
      const finalChannel = update.channel || current.channel;
      const finalKeyword = update.keyword || current.keyword;
      const dup = await payservedb.AutoReplyRule.findOne({
        _id: { $ne: id },
        channel: finalChannel,
        keyword: { $regex: `^${finalKeyword}$`, $options: 'i' },
      });
      if (dup) {
        return reply.code(409).send({
          success: false,
          error: `A rule for "${finalKeyword}" on ${finalChannel} already exists`,
        });
      }
    }

    const row = await payservedb.AutoReplyRule.findByIdAndUpdate(id, update, { new: true });
    if (!row) return reply.code(404).send({ success: false, error: 'Rule not found' });

    return reply.code(200).send({ success: true, data: row });
  } catch (err) {
    logger.error('update_rule error', err);
    return reply.code(500).send({ success: false, error: 'Failed to update rule' });
  }
}

module.exports = update_rule;
