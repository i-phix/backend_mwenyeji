const payservedb = require('payservedb');

const deleteAnalogMeter = async (request, reply) => {
    try {
        const { facilityId, meterId } = request.params;

        if (!meterId) {
            return reply.code(400).send({
                error: 'Meter ID is required'
            });
        }

        const deletedMeter = await payservedb.WaterMeter.findByIdAndDelete(meterId);

        if (!deletedMeter) {
            return reply.code(404).send({
                error: 'Analog meter not found'
            });
        }

        return reply.code(200).send({
            message: 'Analog meter deleted successfully',
            meter: deletedMeter
        });
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = deleteAnalogMeter;