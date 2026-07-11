/**
 * GET /api/core/customer_obsession/recipient-groups/config
 *
 * Returns the cap configuration the admin UI and agent bulk-send UI both
 * obey. Sourced from env vars so ops can tune per-deployment without a
 * deploy. Defaults to 500 for both caps.
 */
async function get_config(request, reply) {
  const max_members_per_group = Number(process.env.CO_MAX_MEMBERS_PER_GROUP) || 500;
  const max_bulk_send_per_request = Number(process.env.CO_MAX_BULK_SEND_PER_REQUEST) || 500;
  return reply.code(200).send({
    success: true,
    data: { max_members_per_group, max_bulk_send_per_request },
  });
}

module.exports = get_config;
