const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const get_protocols = async (request, reply) => {
    try {
        const protocolModel = await getModel('MeterProtocol', payservedb.MeterProtocol.schema);
        
        const protocols = await protocolModel.find().sort({ createdAt: -1 });
        
        return reply.code(200).send(protocols);
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_protocols;