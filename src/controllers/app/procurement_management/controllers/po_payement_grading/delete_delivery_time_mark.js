const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../../../utils/getModel');

const delete_delivery_time_mark = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.body.facilityId;
        const deliveryTimeMarkId = request.params.id;

        const deliveryTimeMarkModel = await getModel('DeliveryTimeMark', payservedb.DeliveryTimeMark.schema, facilityId);

        // Delete the delivery time mark
        await deliveryTimeMarkModel.findByIdAndDelete(deliveryTimeMarkId);

        return reply.code(200).send({
            success: true,
            message: 'Delivery time mark deleted successfully'
        });
    } catch (err) {
        console.error('Error in deleting delivery time mark:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while deleting the delivery time mark'
        });
    }
};

module.exports = delete_delivery_time_mark;