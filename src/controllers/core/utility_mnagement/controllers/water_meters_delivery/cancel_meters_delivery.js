const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const cancelDelivery = async (request, reply) => {
    try {
        const deliveryModel = await getModel('MetersDelivery', payservedb.MetersDelivery.schema);

        const deliveryId = request.params.deliveryId;

        const delivery = await deliveryModel.findById(deliveryId);
        if (!delivery) {
            throw new Error('Delivery not found');
        }

        if (delivery.status === 'cancelled') {
            throw new Error('Delivery is already cancelled');
        }

        delivery.status = 'cancelled';
        await delivery.save();

        return reply.code(200).send({ message: 'Delivery cancelled successfully' });

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = cancelDelivery;
