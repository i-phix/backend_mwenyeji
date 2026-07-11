const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const deleteEntryExit = async (request, reply) => {
    try {
        const { facilityId, accessId } = request.params;

        const entryExitModel = await getModel('EntryExit', payservedb.EntryExit.schema, facilityId);


        // Fetch the entry first to check its status
        const entry = await entryExitModel.findById(accessId);

        // Only allow deletion if the record is disabled
        if (!entry.disabled) {
            return reply.code(403).send({ error: 'You can only delete a disabled record' });
        }

        await entryExitModel.findByIdAndDelete(accessId);

        return reply.code(200).send({success: true, message: 'Access point deleted successfully'});
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = deleteEntryExit

