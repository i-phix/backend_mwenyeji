const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const add_iot_card = async (request, reply) => {
    try {
        const iotCardModel = await getModel('MeterIotCard', payservedb.MeterIotCard.schema);

        const { serialNumber, provider, concentrator, location, status } = request.body;

        // Check if card already exists
        const cardExists = await iotCardModel.findOne({ serialNumber });
        if (cardExists) {
            throw new Error('IoT card with this serial number already exists');
        }

        // Create new IoT card
        const data = new iotCardModel({
            serialNumber,
            provider,
            concentrator,
            location,
            status: status || 'inactive'
        });
        
        const response = await data.save();
        
        return reply.code(200).send({ message: 'IoT card added successfully' });
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_iot_card;