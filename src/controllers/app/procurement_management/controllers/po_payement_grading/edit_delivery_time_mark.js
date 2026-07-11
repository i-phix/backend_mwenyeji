const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../../../utils/getModel');

const edit_delivery_time_mark = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.body.facilityId;
        const deliveryTimeMarkId = request.params.id;
        
        const { deliveryDays, marks } = request.body;
        
        const deliveryTimeMarkModel = await getModel('DeliveryTimeMark', payservedb.DeliveryTimeMark.schema, facilityId);

        // Check if delivery time mark exists
        const existingDeliveryTimeMark = await deliveryTimeMarkModel.findById(deliveryTimeMarkId);
        if (!existingDeliveryTimeMark) {
            return reply.code(404).send({
                success: false,
                error: 'Delivery time mark not found'
            });
        }

        // Check if delivery days already exists (excluding current record)
        const duplicateDeliveryTime = await deliveryTimeMarkModel.findOne({ 
            deliveryDays,
            _id: { $ne: deliveryTimeMarkId }
        });
        if (duplicateDeliveryTime) {
            return reply.code(409).send({
                success: false,
                error: 'Delivery time for this number of days already exists'
            });
        }

        // Update the delivery time mark
        const updatedDeliveryTimeMark = await deliveryTimeMarkModel.findByIdAndUpdate(
            deliveryTimeMarkId,
            {
                deliveryDays,
                marks
            },
            { new: true, runValidators: true }
        );

        return reply.code(200).send({
            success: true,
            message: 'Delivery time mark updated successfully',
            data: updatedDeliveryTimeMark
        });
    } catch (err) {
        console.error('Error in updating delivery time mark:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while updating the delivery time mark'
        });
    }
};

module.exports = edit_delivery_time_mark;
