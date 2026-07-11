const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const update_service_request = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { serviceRequestId, status, assigneeId, amount } = request.body;

        // Validate required fields
        if (!status) {
            return reply.code(400).send({ error: 'Status is required' });
        }

        // Dynamically get the ServiceRequest model for the specified facility
        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);

        // Convert string ID to ObjectId
        const serviceRequestIdObjectId = new mongoose.Types.ObjectId(serviceRequestId);

        // Prepare update object
        const updateFields = { status };

        // Add assigneeId and amount if they are provided (for work orders)
        if (assigneeId) {
            updateFields.assigneeId = new mongoose.Types.ObjectId(assigneeId);
        }

        if (amount !== undefined && amount !== null) {
            updateFields.amount = amount;
        }

        // Update the service request with all the provided fields
        const updatedServiceRequest = await ServiceRequest.findOneAndUpdate(
            { _id: serviceRequestIdObjectId },
            updateFields,
            { new: true }
        );

        if (!updatedServiceRequest) {
            return reply.code(404).send({ error: 'Service request not found' });
        }

        return reply.code(200).send({
            message: 'Service request updated successfully',
            data: updatedServiceRequest
        });
    } catch (err) {
        console.error('Error updating service request:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_service_request;