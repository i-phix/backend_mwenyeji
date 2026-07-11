const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const get_manufacturers = async (request, reply) => {
    try {
        const manufacturerModel = await getModel('MeterManufacturer', payservedb.MeterManufacturer.schema);
        
        const manufacturers = await manufacturerModel.find().sort({ createdAt: -1 });
        
        return reply.code(200).send(manufacturers);
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_manufacturers;