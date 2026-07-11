const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

/**
 * GET /api/customer_obsession/recipient-groups?channel=email|whatsapp
 *
 * Agent view: returns groups that match the requested channel. A group with
 * channel='both' is returned for either filter. No audit metadata.
 */
async function list_groups(request, reply) {
  try {
    const channel = String(request.query?.channel || '').toLowerCase();
    const filter = {};
    if (channel === 'email') filter.channel = { $in: ['email', 'both'] };
    else if (channel === 'whatsapp') filter.channel = { $in: ['whatsapp', 'both'] };

    const groups = await payservedb.RecipientGroup
      .find(filter)
      .select('name channel description member_count')
      .sort({ name: 1 })
      .lean();
    return reply.code(200).send({ success: true, data: groups });
  } catch (err) {
    logger.error('list_groups (agent) error', err);
    return reply.code(500).send({ success: false, error: 'Failed to load groups' });
  }
}

module.exports = list_groups;
