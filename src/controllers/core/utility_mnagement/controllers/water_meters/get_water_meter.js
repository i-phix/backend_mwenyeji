const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const get_meter = async (request, reply) => {
    try {
        const { meterId } = request.params;
        const meter = await payservedb.WaterMeter.findById(meterId);
        
        if (!meter) {
            return reply.code(404).send({ error: 'Water meter not found' });
        }
        
        return reply.code(200).send(meter);
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_meter;