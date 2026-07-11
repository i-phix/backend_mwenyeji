const payservedb = require('payservedb');

async function getOrCreateSettings() {
  return payservedb.Settings.findOneAndUpdate(
    { name: 'customer_obsession_global', size: 'global' },
    { $setOnInsert: { name: 'customer_obsession_global', size: 'global', escalation_timer_minutes: null } },
    { upsert: true, new: true, runValidators: false }
  );
}

async function get_escalation_settings(request, reply) {
  try {
    const settings = await getOrCreateSettings();

    return reply.code(200).send({
      success: true,
      data: {
        escalation_timer_minutes: settings.escalation_timer_minutes ?? null,
        escalation_target_level: settings.escalation_target_level ?? 3
      }
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to retrieve escalation settings',
      details: error.message
    });
  }
}

module.exports = get_escalation_settings;
