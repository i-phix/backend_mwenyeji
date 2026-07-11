const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * POST /api/core/customer_obsession/recipient-groups
 * body { name, channel, description? }
 */
async function add_group(request, reply) {
  try {
    const { name, channel, description } = request.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({ success: false, error: 'name is required' });
    }
    if (!channel || !['email', 'whatsapp', 'both'].includes(channel)) {
      return reply.code(400).send({ success: false, error: 'channel must be email, whatsapp, or both' });
    }

    const duplicate = await payservedb.RecipientGroup.findOne({
      name: { $regex: `^${name.trim()}$`, $options: 'i' },
    });
    if (duplicate) {
      return reply.code(409).send({ success: false, error: 'A group with that name already exists' });
    }

    const row = await payservedb.RecipientGroup.create({
      name: name.trim(),
      channel,
      description: (description || '').trim(),
      created_by: request.user?.userId,
      updated_by: request.user?.userId,
      member_count: 0,
    });

    return reply.code(200).send({ success: true, data: row });
  } catch (err) {
    logger.error('add_group error', err);
    return reply.code(500).send({ success: false, error: 'Failed to create group' });
  }
}

module.exports = add_group;
