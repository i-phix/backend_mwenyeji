const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const updateDelivery = async (request, reply) => {
    try {
      const deliveryModel = await getModel('MetersDelivery', payservedb.MetersDelivery.schema);
      const deliveryId = request.params.deliveryId;
      const updates = request.body;
  
      const existingDelivery = await deliveryModel.findById(deliveryId);
      if (!existingDelivery) {
        throw new Error('Delivery not found');
      }
    
      if (existingDelivery.status === 'cancelled' && updates.status !== 'cancelled') {
        throw new Error('Cannot modify cancelled delivery');
      }
  
      const updatedDelivery = await deliveryModel.findByIdAndUpdate(
        deliveryId,
        { $set: updates },
        { new: true, runValidators: true }
      );
  
      return reply.code(200).send(updatedDelivery);
    } catch (err) {
      return reply.code(502).send({ error: err.message });
    }
  };

module.exports = updateDelivery;
