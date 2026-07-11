const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_lease_agreement = async (request, reply) => {
    try {
        const { facilityId, leaseId } = request.params;

        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);

        const leaseAgreement = await leaseAgreementModel.findById(leaseId);
        if (!leaseAgreement) {
            return reply.code(404).send({ error: `Lease Agreement with ID ${leaseId} does not exist.` });
        }

        // Check if the lease is terminated
        // if (leaseAgreement.status !== 'Terminated') {
        //     return reply.code(400).send({ error: `Lease Agreement with ID ${leaseId} cannot be deleted because it is not terminated.` });
        // }

        await leaseAgreementModel.deleteOne({ _id: leaseId });

        return reply.code(200).send({
            message: 'Lease Agreement deleted successfully',
        });
    } catch (err) {
        console.error('Error in delete_lease_agreement:', err.stack);
        return reply.code(500).send({ error: 'An error occurred while deleting the lease agreement.' });
    }
};

module.exports = delete_lease_agreement;