// GET /api/move_in/checklists — authenticated tenant
// No move-in checklist feature exists yet (no controller anywhere creates
// checklist records) — returns an empty, correctly-shaped list rather than
// erroring, so the page renders its normal empty state instead of breaking.
async function getChecklists(request, reply) {
  return reply.code(200).send({ success: true, data: [] });
}

module.exports = getChecklists;
