const payservedb = require('payservedb');

const toggleDisableReminder = async (request, reply) => {
  try {
    const { reminderId } = request.params;
    const { disabled } = request.body;

    const query = { _id: reminderId };
    const update = { disabled: disabled };

    await payservedb.Reminder.findByIdAndUpdate(query, update);

    return reply.code(200).send(`Reminder ${disabled ? 'disabled' : 'enabled'} successfully`);
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = toggleDisableReminder;
