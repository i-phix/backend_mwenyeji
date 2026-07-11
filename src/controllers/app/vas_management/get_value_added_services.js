const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_value_added_services = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get the facility-specific ValueAddedService model
        const ValueAddedServiceModel = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);

        // Use the ValueAddedServiceModel to query the database
        const services = await ValueAddedServiceModel.find({ facilityId });

        // Return consistent response structure with appropriate message
        return reply.code(200).send({
            message: services.length
                ? 'Value-added services retrieved successfully'
                : 'No value-added services found for this facility',
            services: services
        });

    } catch (err) {
        // Log the error with more context
        console.error('Error in get_value_added_service for facilityId:', request.params.facilityId, err);

        // Return a structured error response
        return reply.code(500).send({
            error: 'Internal server error while retrieving value-added services'
        });
    }
};

module.exports = get_value_added_services;