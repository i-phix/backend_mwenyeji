const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_visitors = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);

        const visitors = await visitorModel.find({ facilityId: facilityId }).sort({_id:-1});

        return reply.code(200).send({ success: true, data: visitors });
    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = get_visitors;
