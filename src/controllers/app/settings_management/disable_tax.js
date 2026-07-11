const payservedb = require('payservedb');

const toggleDisableTax = async (request, reply) => {
  try {
    const { taxId } = request.params;
    const { disabled } = request.body;

    const query = { _id: taxId };
    const update = { disabled: disabled };

    await payservedb.Tax.findByIdAndUpdate(query, update);

    return reply.code(200).send(`Tax ${disabled ? 'disabled' : 'enabled'} successfully`);
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = toggleDisableTax;
