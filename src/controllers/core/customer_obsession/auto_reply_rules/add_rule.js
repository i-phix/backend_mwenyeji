const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * POST /api/core/customer_obsession/auto-reply-rules
 * body { channel, keyword, reply, enabled?, priority? }
 */
async function add_rule(request, reply) {
  try {
    const { channel, keyword, reply: replyText, enabled, priority } = request.body || {};
    if (!channel || !['email', 'whatsapp'].includes(channel)) {
      return reply.code(400).send({ success: false, error: 'channel must be email or whatsapp' });
    }
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return reply.code(400).send({ success: false, error: 'keyword is required' });
    }
    if (/\s/.test(keyword.trim())) {
      return reply.code(400).send({ success: false, error: 'keyword must be a single word' });
    }
    if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
      return reply.code(400).send({ success: false, error: 'reply text is required' });
    }
    if (replyText.length > 1000) {
      return reply.code(400).send({ success: false, error: 'reply must be 1000 characters or less' });
    }

    // Duplicate guard (channel + keyword, case-insensitive)
    const existing = await payservedb.AutoReplyRule.findOne({
      channel,
      keyword: { $regex: `^${keyword.trim()}$`, $options: 'i' },
    });
    if (existing) {
      return reply.code(409).send({
        success: false,
        error: `A rule for "${keyword.trim()}" on ${channel} already exists`,
      });
    }

    // If priority not supplied, append at the end (lowest priority).
    let nextPriority = Number.isFinite(Number(priority)) ? Number(priority) : null;
    if (nextPriority === null) {
      const lowest = await payservedb.AutoReplyRule.find({}).sort({ priority: -1 }).limit(1).lean();
      nextPriority = lowest.length ? Number(lowest[0].priority || 0) + 1 : 0;
    }

    const row = await payservedb.AutoReplyRule.create({
      channel,
      keyword: keyword.trim(),
      reply: replyText.trim(),
      enabled: enabled !== false,
      priority: nextPriority,
      created_by: request.user?.userId,
      updated_by: request.user?.userId,
    });

    return reply.code(200).send({ success: true, data: row });
  } catch (err) {
    logger.error('add_rule error', err);
    return reply.code(500).send({ success: false, error: 'Failed to create rule' });
  }
}

module.exports = add_rule;
