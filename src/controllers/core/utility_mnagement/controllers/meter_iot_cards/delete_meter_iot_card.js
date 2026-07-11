const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const delete_iot_card = async (request, reply) => {
    try {
        const iotCardModel = await getModel('MeterIotCard', payservedb.MeterIotCard.schema);
        
        const { id } = request.params;
        
        const result = await iotCardModel.findByIdAndDelete(id);
        
        if (!result) {
            throw new Error('IoT card not found');
        }
        
        return reply.code(200).send({ message: 'IoT card deleted successfully' });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_iot_card;