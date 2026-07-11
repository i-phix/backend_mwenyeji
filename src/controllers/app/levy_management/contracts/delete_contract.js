const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const deleteLevyContract = async (request, reply) => {
    try {
        const { facilityId, contractId } = request.params;

        // Get the LevyContract model for the specified facility
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);

        // Find and delete the contract
        const deletedContract = await levyContractModel.findByIdAndDelete(contractId);
        if (!deletedContract) {
            return reply.code(404).send({ error: 'LevyContract not found.' });
        }

        return reply.code(200).send({
            message: 'LevyContract deleted successfully',
            contract: deletedContract
        });
    } catch (err) {
        console.error('Error in deleteLevyContract:', err);
        return reply.code(500).send({ error: 'An error occurred while deleting the LevyContract.' });
    }
};

module.exports = deleteLevyContract;
