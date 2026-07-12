// GET /api/move_in/handovers — authenticated tenant
// Same situation as checklists — no handover-scheduling feature exists
// yet, so this returns an empty list rather than erroring.
async function getHandovers(request, reply) {
  return reply.code(200).send({ success: true, data: [] });
}

module.exports = getHandovers;
