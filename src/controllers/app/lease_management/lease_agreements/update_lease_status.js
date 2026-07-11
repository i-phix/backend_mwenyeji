// update_lease_status.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const update_lease_status = async (request, reply) => {
    try {
        const { facilityId, leaseId } = request.params;
        const { status } = request.body;

        // Validate status
        const validStatuses = ['Active', 'Pending', 'Expired', 'Terminated'];
        if (!validStatuses.includes(status)) {
            return reply.code(400).send({ 
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            });
        }

        // Get the lease model
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);

        // Find the lease agreement
        const leaseAgreement = await leaseAgreementModel.findById(leaseId);
        if (!leaseAgreement) {
            return reply.code(404).send({ 
                error: `Lease Agreement with ID ${leaseId} does not exist.` 
            });
        }

        // Validate status transitions
        if (!isValidStatusTransition(leaseAgreement.status, status)) {
            return reply.code(400).send({ 
                error: `Invalid status transition from ${leaseAgreement.status} to ${status}` 
            });
        }

        // Update the status
        leaseAgreement.status = status;
        await leaseAgreement.save();

        return reply.code(200).send({
            success: true,
            message: `Lease Agreement status updated to ${status} successfully`,
            leaseAgreement
        });
    } catch (err) {
        console.error('Error in update_lease_status:', err.stack);
        return reply.code(500).send({ 
            error: 'An error occurred while updating the lease agreement status.' 
        });
    }
};

// Helper function to validate status transitions
const isValidStatusTransition = (currentStatus, newStatus) => {
    // Define valid transitions
    const validTransitions = {
        'Active': ['Expired', 'Terminated'],
        'Pending': ['Active', 'Terminated'],
        'Expired': ['Expired'], // Can't change from expired
        'Terminated': ['Terminated'] // Can't change from terminated
    };

    return validTransitions[currentStatus]?.includes(newStatus);
};

module.exports = update_lease_status;