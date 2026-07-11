const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const download_lease = async (request, reply) => {
    try {
        const { leaseId, type } = request.params; // `type` can be 'signed' or 'unsigned'

        const leaseModel = await getModel('Lease', payservedb.Lease.schema, request.query.facilityId);

        const lease = await leaseModel.findById(leaseId);

        if (!lease) {
            return reply.code(404).send({ error: 'Lease not found.' });
        }

        const fileUrl = type === 'signed' ? lease.signedCopyUrl : lease.unsignedCopyUrl;

        if (!fileUrl) {
            return reply.code(404).send({ error: `${type === 'signed' ? 'Signed' : 'Unsigned'} lease copy not available.` });
        }

        // File download
        return reply.redirect(fileUrl);
    } catch (err) {
        console.error('Error downloading lease:', err.message);
        return reply.code(502).send({ error: 'Failed to download lease.' });
    }
};

module.exports = download_lease;
