const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const add_protocol = async (request, reply) => {
    try {
        const protocolModel = await getModel('MeterProtocol', payservedb.MeterProtocol.schema);

        const { name } = request.body;

        // Check if protocol already exists
        const protocolExists = await protocolModel.findOne({ name });
        if (protocolExists) {
            throw new Error('Protocol already exists');
        }

        // Create new protocol
        const data = new protocolModel({ name });
        const response = await data.save();
        
        return reply.code(200).send({ message: 'Protocol added successfully' });
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_protocol;