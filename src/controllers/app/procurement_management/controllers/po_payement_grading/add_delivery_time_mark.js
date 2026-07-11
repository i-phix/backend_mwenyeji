const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../../../utils/getModel');

const add_delivery_time_mark = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.body.facilityId;
        
        const { deliveryDays, marks } = request.body;

        const deliveryTimeMarkModel = await getModel('DeliveryTimeMark', payservedb.DeliveryTimeMark.schema, facilityId);

        // Check if delivery days already exists
        const existingDeliveryTime = await deliveryTimeMarkModel.findOne({ deliveryDays });
        if (existingDeliveryTime) {
            return reply.code(409).send({
                success: false,
                error: 'Delivery time for this number of days already exists'
            });
        }

        // Create new delivery time mark
        const newDeliveryTimeMark = new deliveryTimeMarkModel({
            deliveryDays,
            marks
        });

        const savedDeliveryTimeMark = await newDeliveryTimeMark.save();

        return reply.code(200).send({
            success: true,
            message: 'Delivery time mark created successfully',
            data: savedDeliveryTimeMark
        });
    } catch (err) {
        console.error('Error in creating delivery time mark:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while creating the delivery time mark'
        });
    }
};

module.exports = add_delivery_time_mark;