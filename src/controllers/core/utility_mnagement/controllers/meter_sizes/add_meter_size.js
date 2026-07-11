const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const add_meter_size = async (request, reply) => {
    try {
        const meterSizeModel = await getModel('MeterSize', payservedb.MeterSize.schema);

        const { code } = request.body;

        // Check if meter size already exists
        const sizeExists = await meterSizeModel.findOne({ code });
        if (sizeExists) {
            throw new Error('Meter size already exists');
        }

        // Create new meter size
        const data = new meterSizeModel({ code });
        const response = await data.save();
     
        return reply.code(200).send({ message: 'Meter size added successfully' });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_meter_size;