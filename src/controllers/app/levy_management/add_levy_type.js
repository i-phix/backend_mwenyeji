const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const add_levy_type = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const levyType = request.body;

        const levyTypeModel = await getModel('LevyType', payservedb.LevyType.schema, facilityId);

        const existingLevyType = await levyTypeModel.findOne({
            name: levyType,
        });

        if (existingLevyType) {
            return reply.code(409).send({ error: 'Levy Type already exists' });
        }

        const data = new levyTypeModel({
            name: levyType,
            facilityId: facilityId
        });

        await data.save();

        return reply.code(200).send({ message: 'Levy type added successfully', levyType: data });
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};


module.exports = add_levy_type;