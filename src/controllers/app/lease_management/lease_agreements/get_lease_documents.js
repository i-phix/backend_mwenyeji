const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getLeaseDocuments = async (request, reply) => {
    try {
        const { facilityId, leaseId } = request.params;
        
        console.log(`Fetching documents for facilityId=${facilityId}, leaseId=${leaseId}`);
        
        if (!facilityId || !leaseId) {
            console.error("Missing required parameters");
            return reply.code(400).send({ 
                success: false, 
                error: 'Missing required parameters: facilityId and leaseId are required' 
            });
        }

        // Get the model for the specified facility
        const LeaseAgreement = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);

        // Find the lease agreement
        const lease = await LeaseAgreement.findById(leaseId);
        
        if (!lease) {
            console.error(`Lease agreement with ID ${leaseId} not found`);
            return reply.code(404).send({ 
                success: false, 
                error: `Lease agreement with ID ${leaseId} not found` 
            });
        }

        // Get the documents from the lease
        const documents = lease.leaseDocuments || [];
        
        console.log(`Found ${documents.length} documents for lease ${leaseId}`);
        
        return reply.code(200).send({
            success: true,
            leaseDocuments: documents
        });
    } catch (err) {
        console.error('Error fetching lease documents:', err);
        return reply.code(500).send({ 
            success: false, 
            error: err.message || 'Internal server error' 
        });
    }
};

module.exports = getLeaseDocuments;