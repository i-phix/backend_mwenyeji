const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const toggleDisableEntryAndExit = async (request, reply) => {
  try {
    const { facilityId, accessId } = request.params;
    const { disabled } = request.body;

    const query = { _id: accessId };
    const update = { disabled: disabled };

    const entryExitModel = await getModel('EntryExit', payservedb.EntryExit.schema, facilityId);


    await entryExitModel.findByIdAndUpdate(query, update);

    return reply.code(200).send({success: true, message: `Entry/Exit point ${disabled ? 'disabled' : 'enabled'} successfully`});
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = toggleDisableEntryAndExit;
