const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const get_iot_cards = async (request, reply) => {
    try {
        const iotCardModel = await getModel('MeterIotCard', payservedb.MeterIotCard.schema);
        
        const cards = await iotCardModel.find().sort({ createdAt: -1 });
        
        return reply.code(200).send(cards);
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_iot_cards;