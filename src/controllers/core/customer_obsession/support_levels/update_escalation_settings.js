const payservedb = require('payservedb');

async function update_escalation_settings(request, reply) {
  try {
    const { escalation_timer_minutes, escalation_target_level } = request.body;

    if (escalation_timer_minutes !== null && escalation_timer_minutes !== undefined) {
      const parsed = Number(escalation_timer_minutes);
      if (Number.isNaN(parsed) || parsed < 0) {
        return reply.code(400).send({
          success: false,
          error: 'escalation_timer_minutes must be a positive number or null'
        });
      }
    }

    if (escalation_target_level !== undefined && escalation_target_level !== null) {
      if (![2, 3].includes(Number(escalation_target_level))) {
        return reply.code(400).send({
          success: false,
          error: 'escalation_target_level must be 2 or 3'
        });
      }
    }

    const updateFields = {
      escalation_timer_minutes:
        escalation_timer_minutes === null || escalation_timer_minutes === undefined
          ? null
          : Number(escalation_timer_minutes)
    };

    if (escalation_target_level !== undefined) {
      updateFields.escalation_target_level =
        escalation_target_level === null ? 3 : Number(escalation_target_level);
    }

    const updated = await payservedb.Settings.findOneAndUpdate(
      { name: 'customer_obsession_global', size: 'global' },
      { $set: updateFields },
      { upsert: true, new: true, runValidators: false }
    );

    return reply.code(200).send({
      success: true,
      message: 'Escalation settings updated successfully',
      data: {
        escalation_timer_minutes: updated.escalation_timer_minutes,
        escalation_target_level: updated.escalation_target_level ?? 3
      }
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to update escalation settings',
      details: error.message
    });
  }
}

module.exports = update_escalation_settings;
