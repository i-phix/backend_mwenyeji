const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const delete_manufacturer = async (request, reply) => {
    try {
        const manufacturerModel = await getModel('MeterManufacturer', payservedb.MeterManufacturer.schema);
        
        const { id } = request.params;
        
        const result = await manufacturerModel.findByIdAndDelete(id);
        
        if (!result) {
            throw new Error('Manufacturer not found');
        }
        
        return reply.code(200).send({ message: 'Manufacturer deleted successfully' });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_manufacturer;