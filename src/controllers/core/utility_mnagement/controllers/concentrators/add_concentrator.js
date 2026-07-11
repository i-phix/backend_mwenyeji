const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const add_concentrator = async (request, reply) => {
    try {
        const concentratorModel = await getModel('Concentrator', payservedb.Concentrator.schema, request.params.facilityId);
        
        const { 
            serialNumber,
            manufacturer,
            range,
            isInstalled,
            isFaulty,
            inStock,
            status,
            ipAddress   
        } = request.body;

        // Check if concentrator already exists
        const concentratorExists = await concentratorModel.findOne({ 
            serialNumber: serialNumber 
        });

        if (concentratorExists) {
            throw new Error('Concentrator with this serial number already exists');
        }

        // Create new concentrator
        const data = new concentratorModel({
            serialNumber,
            manufacturer,
            range,
            isInstalled: isInstalled || false,
            isFaulty: isFaulty || false,
            inStock: inStock !== undefined ? inStock : true,
            status: status || 'offline',
            ipAddress: ipAddress || null,   
            facilityId: request.params.facilityId 
        });

        const response = await data.save();
        
        return reply.code(200).send({ message: 'Concentrator added successfully'});

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_concentrator;
