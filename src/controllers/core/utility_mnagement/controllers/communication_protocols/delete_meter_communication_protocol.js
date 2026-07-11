const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const delete_protocol = async (request, reply) => {
    try {
        const protocolModel = await getModel('MeterProtocol', payservedb.MeterProtocol.schema);
        
        const { name } = request.params;
        
        const result = await protocolModel.findOneAndDelete({ name });
        
        if (!result) {
            throw new Error('Protocol not found');
        }
        
        return reply.code(200).send({ message: 'Protocol deleted successfully' });
    } catch (err) {
      
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_protocol;