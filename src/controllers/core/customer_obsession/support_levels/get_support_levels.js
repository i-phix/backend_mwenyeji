const payservedb = require('payservedb');

const DEFAULT_LEVELS = [
  {
    level: 1,
    name: '1st Level Support',
    description: 'Handles first-contact support and basic issue triage.',
    roles: ['call_center_agent']
  },
  {
    level: 2,
    name: '2nd Level Support',
    description: 'Handles advanced and technical escalations.',
    roles: ['team_leader', 'supervisor', 'technician']
  },
  {
    level: 3,
    name: '3rd Level Support',
    description: 'Handles management-level escalations and final decisions.',
    roles: ['manager']
  }
];

async function seedIfMissing() {
  const count = await payservedb.SupportLevelConfig.countDocuments({});
  if (count > 0) {
    return;
  }

  await payservedb.SupportLevelConfig.insertMany(DEFAULT_LEVELS.map((level) => ({
    ...level,
    auto_escalation_minutes: level.level === 1 ? null : null
  })));
}

async function get_support_levels(request, reply) {
  try {
    await seedIfMissing();

    const levels = await payservedb.SupportLevelConfig.find({})
      .sort({ level: 1 })
      .lean();

    return reply.code(200).send({
      success: true,
      data: levels
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to retrieve support levels',
      details: error.message
    });
  }
}

module.exports = get_support_levels;
