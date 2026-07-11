const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_active_levy_contracts_count = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);

        const count = await levyContractModel.countDocuments({ 
            facilityId, 
            status: 'Active' 
        });

        return reply.code(200).send({
            success: true,
            count
        });

    } catch (err) {
        console.error('Error in get_active_levy_contracts_count:', err.message);

        return reply.code(500).send({
            success: false,
            error: 'An error occurred while fetching active levy contracts count.'
        });
    }
};

module.exports = get_active_levy_contracts_count;