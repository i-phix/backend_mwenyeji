const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const disableContract = async (request, reply) => {
    try {
        const { facilityId, contractId } = request.params;
        const { status } = request.body;

        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);

        // Find the contract
        const contract = await levyContractModel.findById(contractId);
        if (!contract) {
            return reply.code(404).send({ message: 'Contract not found' });
        }

        // Update the status
        contract.status = status;
        await contract.save();

        console.log('After Update:', contract.status);

        return reply.code(200).send({
            message: `Contract ${status === 'Inactive' ? 'disabled' : 'enabled'} successfully.`,
            updatedContract: contract,
        });
    } catch (err) {
        console.error('Error in disableContract:', err);
        return reply.code(500).send({ error: err.message });
    }
};


module.exports = disableContract;
