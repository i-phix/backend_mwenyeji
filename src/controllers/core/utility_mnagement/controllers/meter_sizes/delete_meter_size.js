const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const delete_meter_size = async (request, reply) => {
    try {
        const meterSizeModel = await getModel('MeterSize', payservedb.MeterSize.schema);
        
        const { code } = request.params;
        
        const result = await meterSizeModel.findOneAndDelete({ code });
        
        if (!result) {
            throw new Error('Meter size not found');
        }
        
        return reply.code(200).send({ message: 'Meter size deleted successfully' });
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_meter_size;