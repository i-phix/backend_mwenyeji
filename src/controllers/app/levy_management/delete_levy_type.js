const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const delete_levy_type = async (request, reply) => {
    try {
        const { facilityId, levyTypeId } = request.params;

        const levyTypeModel = await getModel('LevyType', payservedb.LevyType.schema, facilityId);

        // Find the levy type by ID
        const levyType = await levyTypeModel.findById(levyTypeId);

        if (!levyType) {
            return reply.code(404).send({ error: 'Levy Type not found' });
        }

        // Delete the levy type
        await levyTypeModel.deleteOne({ _id: levyTypeId });

        return reply.code(200).send({ message: 'Levy type deleted successfully' });
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_levy_type;