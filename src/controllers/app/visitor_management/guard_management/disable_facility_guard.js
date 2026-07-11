const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const toggleDisableGuard= async (request, reply) => {
  try {
    const { facilityId, guardId } = request.params;
    const { disabled } = request.body;

    const query = { _id: guardId };
    const update = { disabled: disabled };

    const guardModel = await getModel('Guard', payservedb.Guard.schema, facilityId);

    await guardModel.findByIdAndUpdate(query, update);

    return reply.code(200).send({success: true, message: `Guard ${disabled ? 'disabled' : 'enabled'} successfully`});
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = toggleDisableGuard;
