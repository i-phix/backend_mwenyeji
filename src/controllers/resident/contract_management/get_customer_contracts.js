const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

// Fetch Contracts based on customerId and facilityId
const getContractsByCustomer = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params; // Get facilityId and customerId from route params

        // Get the LevyContract model for the specified facility
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);

        // Fetch contracts for the given customerId from the database
        const contracts = await levyContractModel.find({ facilityId, customerId });

        // Check if contracts exist for the customer
        if (!contracts || contracts.length === 0) {
            return reply.code(404).send({ message: 'No contracts found for this customer in the specified facility' });
        }

        // Return the success response with all contract details for the customer
        return reply.code(200).send({
            message: 'Contracts retrieved successfully for the customer',
            contracts
        });
    } catch (err) {
        console.error('Error in getContractsByCustomer:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = getContractsByCustomer;