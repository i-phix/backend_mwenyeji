const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const get_meter_sizes = async (request, reply) => {
    try {
        const meterSizeModel = await getModel('MeterSize', payservedb.MeterSize.schema);
        
        const sizes = await meterSizeModel.find().sort({ createdAt: -1 });
        
        return reply.code(200).send(sizes);
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_meter_sizes;