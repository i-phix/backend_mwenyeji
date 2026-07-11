const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const update_entry_exit = async (request, reply) => {
    try {
        const { facilityId, accessId } = request.params;
        const { name, location, purpose, range } = request.body;

        const query = { _id: accessId };

        const data = {
            name: name,
            location: location,
            purpose: purpose,
            range
        };

        const entryExitModel = await getModel('EntryExit', payservedb.EntryExit.schema, facilityId);


        await entryExitModel.updateOne(query, data);
        return reply.code(200).send({success: true, message: 'Access point updated successfully'});

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_entry_exit;
