const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_active_lease_count = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);

        const count = await leaseAgreementModel.countDocuments({ 
            facilityId, 
            status: 'Active' 
        });

        return reply.code(200).send({
            success: true,
            count
        });

    } catch (err) {
        console.error('Error in get_active_lease_count:', err.message);

        return reply.code(500).send({
            success: false,
            error: 'An error occurred while fetching active lease count.'
        });
    }
};

module.exports = get_active_lease_count;