const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const edit_iot_card = async (request, reply) => {
    try {
        const iotCardModel = await getModel('MeterIotCard', payservedb.MeterIotCard.schema);
        
        const { id } = request.params;
        const updateData = request.body;
        
        const card = await iotCardModel.findById(id);
        
        if (!card) {
            throw new Error('IoT card not found');
        }
        
        // If serialNumber is being updated, check for duplicates
        if (updateData.serialNumber && updateData.serialNumber !== card.serialNumber) {
            const serialExists = await iotCardModel.findOne({ 
                serialNumber: updateData.serialNumber,
                _id: { $ne: id }
            });
            if (serialExists) {
                throw new Error('IoT card with this serial number already exists');
            }
        }
        
        const updated = await iotCardModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        return reply.code(200).send({ 
            message: 'IoT card updated successfully',
            card: updated
        });
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = edit_iot_card;