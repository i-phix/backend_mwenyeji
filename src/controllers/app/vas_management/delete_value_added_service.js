const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const delete_value_added_service = async (request, reply) => {
    try {
        const { facilityId, serviceId } = request.params;

        // Validate facilityId and serviceId
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid facility ID'
            });
        }
        if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid service ID'
            });
        }

        // Get the ValueAddedService model for the facility
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);

        // Check if service exists
        const existingService = await ValueAddedService.findOne({
            _id: serviceId,
            facilityId
        });

        if (!existingService) {
            return reply.code(404).send({
                success: false,
                message: 'Service not found or does not belong to this facility'
            });
        }

        // Delete the service
        const result = await ValueAddedService.deleteOne({
            _id: serviceId,
            facilityId
        });

        // Check if deletion was successful
        if (result.deletedCount === 0) {
            return reply.code(500).send({
                success: false,
                message: 'Service not deleted. Please try again.'
            });
        }

        // Successfully deleted
        return reply.code(200).send({
            success: true,
            message: 'Service deleted successfully'
        });

    } catch (err) {
        console.error('Error in deleting ValueAddedService:', {
            facilityId: request.params.facilityId,
            serviceId: request.params.serviceId,
            error: err
        });

        if (err.name === 'CastError') {
            return reply.code(400).send({
                success: false,
                message: 'Invalid ID format'
            });
        }

        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};


module.exports = delete_value_added_service;
