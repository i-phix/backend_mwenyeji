const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_meter = async (request, reply) => {
    try {
        const meterModel = await getModel('Meter', payservedb.Meter.schema, request.params.facilityId);

        const { 
            serialNumber,
            manufacturer,
            protocol,
            size,
            status,
            initialReading 
        } = request.body;

        // Check if meter already exists
        const meterExists = await meterModel.findOne({ 
            serialNumber: serialNumber 
        });

        if (meterExists) {
            throw new Error('Meter with this serial number already exists');
        }

        // Create new meter
        const data = new meterModel({
            serialNumber,
            manufacturer,
            protocol,
            size,
            status: status || 'active',
            initialReading: initialReading || 0,
            facilityId: request.params.facilityId 
        });

        const response = await data.save();
       
        return reply.code(200).send({ message: 'Meter added successfully' });

    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_meter;
