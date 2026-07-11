const payservedb = require('payservedb');

const toggleDisablePenalty = async (request, reply) => {
  try {
    const { penaltyId } = request.params;
    const { disabled } = request.body;

    const query = { _id: penaltyId };
    const update = { disabled: disabled };

    await payservedb.Penalty.findByIdAndUpdate(query, update);

    return reply.code(200).send(`Penalty ${disabled ? 'disabled' : 'enabled'} successfully`);
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = toggleDisablePenalty;
