const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

/**
 * PUT /api/core/customer_obsession/recipient-groups/:id
 * body { name?, channel?, description? }
 *
 * Note: changing `channel` is allowed but may invalidate existing members
 * (e.g. switching to 'whatsapp' when members have email but no phone).
 * The bulk-send endpoint filters those out at send time.
 */
async function update_group(request, reply) {
  try {
    const { id } = request.params;
    const { name, channel, description } = request.body || {};
    if (!id) return reply.code(400).send({ success: false, error: 'id is required' });

    const update = { updated_by: request.user?.userId };

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return reply.code(400).send({ success: false, error: 'name cannot be empty' });
      }
      const dup = await payservedb.RecipientGroup.findOne({
        _id: { $ne: id },
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
      });
      if (dup) {
        return reply.code(409).send({ success: false, error: 'A group with that name already exists' });
      }
      update.name = name.trim();
    }
    if (channel !== undefined) {
      if (!['email', 'whatsapp', 'both'].includes(channel)) {
        return reply.code(400).send({ success: false, error: 'channel must be email, whatsapp, or both' });
      }
      update.channel = channel;
    }
    if (description !== undefined) update.description = String(description || '').trim();

    const row = await payservedb.RecipientGroup.findByIdAndUpdate(id, update, { new: true });
    if (!row) return reply.code(404).send({ success: false, error: 'Group not found' });

    return reply.code(200).send({ success: true, data: row });
  } catch (err) {
    logger.error('update_group error', err);
    return reply.code(500).send({ success: false, error: 'Failed to update group' });
  }
}

module.exports = update_group;
