const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const edit_manufacturer = async (request, reply) => {
    try {
        const manufacturerModel = await getModel('MeterManufacturer', payservedb.MeterManufacturer.schema);
        
        const { id } = request.params;
        const updateData = request.body;
        
        const manufacturer = await manufacturerModel.findById(id);
        
        if (!manufacturer) {
            throw new Error('Manufacturer not found');
        }
        
        // If name is being updated, check for duplicates
        if (updateData.name && updateData.name !== manufacturer.name) {
            const nameExists = await manufacturerModel.findOne({ 
                name: updateData.name,
                _id: { $ne: id }
            });
            if (nameExists) {
                throw new Error('Manufacturer with this name already exists');
            }
        }
        
        const updated = await manufacturerModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );
       
        return reply.code(200).send({ 
            message: 'Manufacturer updated successfully',
            manufacturer: updated
        });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = edit_manufacturer;