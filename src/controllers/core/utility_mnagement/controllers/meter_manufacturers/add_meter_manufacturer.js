const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const add_manufacturer = async (request, reply) => {
    try {
        const manufacturerModel = await getModel('MeterManufacturer', payservedb.MeterManufacturer.schema);

        const { name, country, contactPerson, email, phoneNumber } = request.body;

        // Check if manufacturer already exists
        const manufacturerExists = await manufacturerModel.findOne({ name });
        if (manufacturerExists) {
            throw new Error('Manufacturer already exists');
        }

        // Create new manufacturer
        const data = new manufacturerModel({
            name,
            country,
            contactPerson,
            email,
            phoneNumber
        });
        
        const response = await data.save();
        
        return reply.code(200).send({ message: 'Manufacturer added successfully' });
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_manufacturer;