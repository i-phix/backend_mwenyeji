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

async function seed_support_levels(request, reply) {
  try {
    const operations = DEFAULT_LEVELS.map((item) => ({
      updateOne: {
        filter: { level: item.level },
        update: {
          $setOnInsert: {
            ...item,
            auto_escalation_minutes: item.level === 1 ? null : null,
            created_at: new Date(),
            updated_at: new Date()
          }
        },
        upsert: true
      }
    }));

    await payservedb.SupportLevelConfig.bulkWrite(operations);

    const levels = await payservedb.SupportLevelConfig.find({}).sort({ level: 1 }).lean();

    return reply.code(200).send({
      success: true,
      message: 'Support levels seeded successfully',
      data: levels
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to seed support levels',
      details: error.message
    });
  }
}

module.exports = seed_support_levels;
