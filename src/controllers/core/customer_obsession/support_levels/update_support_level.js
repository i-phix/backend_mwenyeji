const payservedb = require('payservedb');

async function update_support_level(request, reply) {
  try {
    const { id } = request.params;
    const { name, description, roles, auto_escalation_minutes } = request.body;

    const update = {};

    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (Array.isArray(roles)) update.roles = roles;
    if (auto_escalation_minutes !== undefined) update.auto_escalation_minutes = auto_escalation_minutes;

    const updated = await payservedb.SupportLevelConfig.findByIdAndUpdate(
      id,
      { ...update, updated_at: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return reply.code(404).send({
        success: false,
        error: 'Support level config not found'
      });
    }

    return reply.code(200).send({
      success: true,
      message: 'Support level updated successfully',
      data: updated
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to update support level',
      details: error.message
    });
  }
}

module.exports = update_support_level;
