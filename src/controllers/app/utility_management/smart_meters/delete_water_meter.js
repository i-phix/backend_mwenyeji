const payservedb = require('payservedb');

const delete_meter = async (request, reply) => {
    try {
        const { meterId } = request.params;
        const deletedMeter = await payservedb.Meter.findByIdAndDelete(meterId);
        
        if (!deletedMeter) {
            return reply.code(404).send({ error: 'Water meter not found' });
        }
        
        return reply.code(200).send({ message: 'Water meter deleted successfully' });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_meter;