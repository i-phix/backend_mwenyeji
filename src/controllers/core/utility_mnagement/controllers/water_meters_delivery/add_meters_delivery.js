const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const addDelivery = async (request, reply) => {
    try {
        const deliveryModel = await getModel('MetersDelivery', payservedb.MetersDelivery.schema);
        
        // Generate a unique delivery number
        const generateUniqueDeliveryNumber = async () => {
            while (true) {
                // Generate a random 6-digit number
                const number = Math.floor(100000 + Math.random() * 900000); 
                const deliveryNumber = `DEL${number}`;
                
                // Check if this number already exists
                const exists = await deliveryModel.findOne({ deliveryNumber });
                if (!exists) {
                    return deliveryNumber;
                }
            }
        };

        const { 
            facilityId, 
            facilityName, 
            deliveredBy, 
            deliveryDate, 
            notes, 
            concentrators, 
            meters, 
            status 
        } = request.body;

        // Generate unique delivery number
        const deliveryNumber = await generateUniqueDeliveryNumber();

        // Create new delivery
        const delivery = new deliveryModel({
            deliveryNumber,
            facilityId,
            facilityName,
            deliveredBy,
            deliveryDate: deliveryDate || new Date(),
            notes,
            concentrators,
            meters,
            status: status || 'pending'
        });

        const response = await delivery.save();
        
        return reply.code(200).send({
            message: 'Delivery created successfully',
            delivery: response
        });

    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = addDelivery;