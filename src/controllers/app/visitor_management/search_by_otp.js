const payservedb = require('payservedb')
const { getModel } = require("../../../utils/getModel");

const searchVisitorByCode = async (request, reply) => {
    try {
        const { visitationCode } = request.params;

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);

        const visitLogEntry = await visitLogModel.findOne({ visitationCode });

        if (!visitLogEntry) {
            return reply.code(404).send({ error: 'Visitor with this visitation code not found.' });
        }

        return reply.code(200).send({ success: true, data: visitLogEntry });


    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = searchVisitorByCode
