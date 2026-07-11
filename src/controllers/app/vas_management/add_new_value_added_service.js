const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const add_new_value_added_service = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            serviceName,
            providerType
        } = request.body;

        console.log("Request Body:", request.body);

        if (!serviceName) {
            return reply.code(400).send({
                success: false,
                message: "serviceName is required"
            });
        }

        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);

        const existingService = await ValueAddedService.findOne({
            serviceName: { $regex: new RegExp(`^${serviceName.trim()}$`, 'i') },
            facilityId
        });

        if (existingService) {
            return reply.code(409).send({
                success: false,
                message: 'Service already exists for this facility'
            });
        }

        const newValueAddedService = new ValueAddedService({
            facilityId,
            serviceName,
            providerType
        });

        const savedService = await newValueAddedService.save();

        return reply.code(200).send({
            success: true,
            message: 'Value Added Service added successfully',
            data: savedService
        });

    } catch (err) {
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = add_new_value_added_service;