const payservedb = require('payservedb');

const get_units = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const units = await payservedb.Unit.find({ facilityId: facilityId });

    return reply.code(200).send(units);

  } catch (err) {
    console.log(err)
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_units;
